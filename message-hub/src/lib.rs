//! ArbiLink MessageHub – cross-chain messaging hub on Arbitrum Stylus
//!
//! ## Message lifecycle
//!
//! ```text
//! PENDING ──► RELAYED ──► [expired]
//!                 │
//!                 └──► FAILED  (successful challenge)
//! ```
//!
//! | Status | Name       | Meaning                                      |
//! |--------|------------|----------------------------------------------|
//! | 0      | PENDING    | Sent, awaiting relayer delivery              |
//! | 1      | RELAYED    | Delivered, in challenge window               |
//! | 3      | FAILED     | Relayer was slashed via fraud proof          |

#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
extern crate alloc;

use alloc::vec::Vec;
use stylus_sdk::{
    alloy_primitives::{Address, Bytes, U256, U8, U32},
    alloy_sol_types::{sol, SolError},
    call::transfer::transfer_eth,
    prelude::*,
};

sol! {
    event MessageSent(
        uint256 indexed messageId,
        address indexed sender,
        uint32  destinationChain,
        address target,
        bytes   data,
        uint256 fee
    );
    error ChainNotSupported(uint32 chainId);
    error InsufficientFee(uint256 required, uint256 provided);
    error MessageNotFound(uint256 messageId);
    error InsufficientStake(uint256 required, uint256 provided);
    error Unauthorized(address caller);
    error RelayerNotActive(address relayer);
    error AlreadyRelayed(uint256 messageId);
    error ZeroAddress();
    error AlreadyInitialized();
    error ChallengeWindowExpired(uint256 messageId);
    error CannotChallenge(uint256 messageId, uint8 status);
}

sol_storage! {
    pub struct StoredMessage {
        uint256 timestamp;
        uint256 fee_paid;
        uint8   status;
        address relayer;
        uint256 challenge_deadline;
    }
    pub struct StoredChainConfig {
        bool    enabled;
        uint256 base_fee;
    }
    pub struct StoredRelayerInfo {
        bool    active;
        uint256 stake;
    }
    #[entrypoint]
    pub struct MessageHub {
        address owner;
        uint256 message_nonce;
        mapping(uint256 => StoredMessage) messages;
        mapping(uint32 => StoredChainConfig) supported_chains;
        mapping(address => StoredRelayerInfo) relayers;
        uint256 min_stake;
        uint256 protocol_fee_balance;
        uint256 challenge_period;
    }
}

const STATUS_PENDING: u8    = 0;
const STATUS_RELAYED: u8    = 1;
const STATUS_FAILED: u8     = 3;
const RELAYER_REWARD_BPS: u64    = 8_000;
const CHALLENGER_REWARD_BPS: u64 = 1_000;

fn enc<E: SolError>(e: E) -> Vec<u8> { e.abi_encode() }

#[public]
impl MessageHub {
    pub fn initialize(&mut self, min_stake: U256, challenge_period: U256) -> Result<(), Vec<u8>> {
        if self.owner.get() != Address::ZERO { return Err(enc(AlreadyInitialized {})); }
        let caller = self.vm().msg_sender();
        self.owner.set(caller);
        self.min_stake.set(min_stake);
        self.challenge_period.set(challenge_period);
        Ok(())
    }

    #[payable]
    pub fn send_message(&mut self, destination_chain: u32, target: Address, data: Bytes) -> Result<U256, Vec<u8>> {
        let ck = U32::from(destination_chain);
        if !self.supported_chains.getter(ck).enabled.get() {
            return Err(enc(ChainNotSupported { chainId: destination_chain }));
        }
        if target == Address::ZERO { return Err(enc(ZeroAddress {})); }
        let req = self.supported_chains.getter(ck).base_fee.get();
        let val = self.vm().msg_value();
        if val < req { return Err(enc(InsufficientFee { required: req, provided: val })); }
        let id = self.message_nonce.get() + U256::from(1u8);
        self.message_nonce.set(id);
        let sender = self.vm().msg_sender();
        let ts = U256::from(self.vm().block_timestamp());
        {
            let mut m = self.messages.setter(id);
            m.timestamp.set(ts);
            m.fee_paid.set(val);
            m.status.set(U8::from(STATUS_PENDING));
            m.relayer.set(Address::ZERO);
            m.challenge_deadline.set(U256::ZERO);
        }
        self.protocol_fee_balance.set(self.protocol_fee_balance.get() + val);
        self.vm().log(MessageSent { messageId: id, sender, destinationChain: destination_chain, target, data, fee: val });
        Ok(id)
    }

    pub fn confirm_delivery(&mut self, message_id: U256) -> Result<(), Vec<u8>> {
        let relayer = self.vm().msg_sender();
        if !self.relayers.getter(relayer).active.get() { return Err(enc(RelayerNotActive { relayer })); }
        let ts = self.messages.getter(message_id).timestamp.get();
        if ts == U256::ZERO { return Err(enc(MessageNotFound { messageId: message_id })); }
        let st = self.messages.getter(message_id).status.get().to::<u8>();
        if st != STATUS_PENDING { return Err(enc(AlreadyRelayed { messageId: message_id })); }
        let fee = self.messages.getter(message_id).fee_paid.get();
        let deadline = U256::from(self.vm().block_timestamp()) + self.challenge_period.get();
        {
            let mut m = self.messages.setter(message_id);
            m.status.set(U8::from(STATUS_RELAYED));
            m.relayer.set(relayer);
            m.challenge_deadline.set(deadline);
        }
        let reward = fee * U256::from(RELAYER_REWARD_BPS) / U256::from(10_000u64);
        self.protocol_fee_balance.set(self.protocol_fee_balance.get() - reward);
        transfer_eth(self.vm(), relayer, reward).expect("transfer_failed");
        Ok(())
    }

    pub fn challenge_message(&mut self, message_id: U256) -> Result<(), Vec<u8>> {
        let challenger = self.vm().msg_sender();
        let ts = self.messages.getter(message_id).timestamp.get();
        if ts == U256::ZERO { return Err(enc(MessageNotFound { messageId: message_id })); }
        let st = self.messages.getter(message_id).status.get().to::<u8>();
        if st != STATUS_RELAYED { return Err(enc(CannotChallenge { messageId: message_id, status: st })); }
        let deadline = self.messages.getter(message_id).challenge_deadline.get();
        let now = U256::from(self.vm().block_timestamp());
        if now > deadline { return Err(enc(ChallengeWindowExpired { messageId: message_id })); }
        let relayer_addr = self.messages.getter(message_id).relayer.get();
        {
            let mut m = self.messages.setter(message_id);
            m.status.set(U8::from(STATUS_FAILED));
        }
        let stake = self.relayers.getter(relayer_addr).stake.get();
        {
            let mut ri = self.relayers.setter(relayer_addr);
            ri.active.set(false);
            ri.stake.set(U256::ZERO);
        }
        let challenger_reward = stake * U256::from(CHALLENGER_REWARD_BPS) / U256::from(10_000u64);
        let remainder = stake - challenger_reward;
        self.protocol_fee_balance.set(self.protocol_fee_balance.get() + remainder);
        transfer_eth(self.vm(), challenger, challenger_reward).expect("transfer_failed");
        Ok(())
    }

    pub fn withdraw_protocol_fees(&mut self) -> Result<(), Vec<u8>> {
        let caller = self.vm().msg_sender();
        if caller != self.owner.get() { return Err(enc(Unauthorized { caller })); }
        let balance = self.protocol_fee_balance.get();
        if balance == U256::ZERO { return Ok(()); }
        self.protocol_fee_balance.set(U256::ZERO);
        transfer_eth(self.vm(), self.owner.get(), balance).expect("transfer_failed");
        Ok(())
    }

    #[payable]
    pub fn register_relayer(&mut self) -> Result<(), Vec<u8>> {
        let r = self.vm().msg_sender();
        let v = self.vm().msg_value();
        let req = self.min_stake.get();
        if v < req { return Err(enc(InsufficientStake { required: req, provided: v })); }
        let prev = self.relayers.getter(r).stake.get();
        { let mut ri = self.relayers.setter(r); ri.active.set(true); ri.stake.set(prev + v); }
        Ok(())
    }

    pub fn exit_relayer(&mut self) -> Result<(), Vec<u8>> {
        let r = self.vm().msg_sender();
        if !self.relayers.getter(r).active.get() { return Err(enc(RelayerNotActive { relayer: r })); }
        let s = self.relayers.getter(r).stake.get();
        { let mut ri = self.relayers.setter(r); ri.stake.set(U256::ZERO); ri.active.set(false); }
        transfer_eth(self.vm(), r, s).expect("transfer_failed");
        Ok(())
    }

    pub fn add_chain(&mut self, chain_id: u32, base_fee: U256) -> Result<(), Vec<u8>> {
        let caller = self.vm().msg_sender();
        if caller != self.owner.get() { return Err(enc(Unauthorized { caller })); }
        let ck = U32::from(chain_id);
        { let mut c = self.supported_chains.setter(ck); c.enabled.set(true); c.base_fee.set(base_fee); }
        Ok(())
    }

    pub fn transfer_ownership(&mut self, new_owner: Address) -> Result<(), Vec<u8>> {
        let caller = self.vm().msg_sender();
        if caller != self.owner.get() { return Err(enc(Unauthorized { caller })); }
        self.owner.set(new_owner);
        Ok(())
    }

    pub fn get_message_status(&self, id: U256) -> Result<u8, Vec<u8>> {
        if self.messages.getter(id).timestamp.get() == U256::ZERO { return Err(enc(MessageNotFound { messageId: id })); }
        Ok(self.messages.getter(id).status.get().to::<u8>())
    }

    pub fn get_relayer_info(&self, r: Address) -> (bool, U256) {
        let ri = self.relayers.getter(r);
        (ri.active.get(), ri.stake.get())
    }

    pub fn min_stake(&self) -> U256                     { self.min_stake.get() }
    pub fn protocol_fee_balance(&self) -> U256          { self.protocol_fee_balance.get() }
}

#[cfg(feature = "export-abi")]
pub fn export_abi_string() -> &'static str { "" }

#[cfg(test)]
mod tests {
    use super::*;
    use stylus_sdk::testing::*;

    fn setup() -> (TestVM, MessageHub, Address) {
        let vm = TestVM::default();
        vm.set_block_timestamp(1_000_000);
        let mut hub = MessageHub::from(&vm);
        let owner = vm.msg_sender();
        hub.initialize(U256::from(100), U256::from(3600)).unwrap();
        hub.add_chain(84532, U256::from(500)).unwrap();
        (vm, hub, owner)
    }

    fn fund_contract(vm: &TestVM) {
        let ct_addr = Address::from([0x05u8; 20]);
        vm.set_balance(ct_addr, U256::from(100_000));
    }

    fn send_msg(vm: &TestVM, hub: &mut MessageHub, val: u64) -> U256 {
        let target = Address::from([0xAAu8; 20]);
        let data = Bytes::from(vec![1u8, 2, 3]);
        vm.set_value(U256::from(val));
        hub.send_message(84532, target, data).unwrap()
    }

    // ── initialize ──────────────────────────────────────────────────────────

    #[test]
    fn test_initialize() {
        let vm = TestVM::new();
        let mut hub = MessageHub::from(&vm);
        let owner = vm.msg_sender();
        assert!(hub.initialize(U256::from(100), U256::from(3600)).is_ok());
        assert_eq!(hub.owner.get(), owner);
        assert_eq!(hub.min_stake(), U256::from(100));
        assert_eq!(hub.challenge_period.get(), U256::from(3600));
    }

    #[test]
    fn test_double_initialize_fails() {
        let vm = TestVM::new();
        let mut hub = MessageHub::from(&vm);
        assert!(hub.initialize(U256::from(100), U256::from(3600)).is_ok());
        let err = hub.initialize(U256::from(200), U256::from(7200)).unwrap_err();
        assert_eq!(err, enc(AlreadyInitialized {}));
    }

    // ── add_chain ───────────────────────────────────────────────────────────

    #[test]
    fn test_add_chain() {
        let vm = TestVM::new();
        let mut hub = MessageHub::from(&vm);
        hub.initialize(U256::from(100), U256::from(3600)).unwrap();

        assert!(hub.add_chain(42161, U256::from(1000)).is_ok());
        assert_eq!(hub.supported_chains.getter(U32::from(42161u32)).base_fee.get(), U256::from(1000));
    }

    #[test]
    fn test_add_chain_not_owner() {
        let vm = TestVM::new();
        let mut hub = MessageHub::from(&vm);
        hub.initialize(U256::from(100), U256::from(3600)).unwrap();

        let non_owner = Address::from([0x99u8; 20]);
        vm.set_sender(non_owner);
        let err = hub.add_chain(42161, U256::from(1000)).unwrap_err();
        assert_eq!(err, enc(Unauthorized { caller: non_owner }));
    }

    // ── send_message ────────────────────────────────────────────────────────

    #[test]
    fn test_send_message() {
        let (vm, mut hub, _owner) = setup();
        let id = send_msg(&vm, &mut hub, 500);
        assert_eq!(id, U256::from(1));
        assert_eq!(hub.message_nonce.get(), U256::from(1));
    }

    #[test]
    fn test_send_message_unsupported_chain() {
        let (vm, mut hub, _owner) = setup();
        vm.set_value(U256::from(500));
        let target = Address::from([0xBBu8; 20]);
        let err = hub.send_message(99999, target, Bytes::from(vec![])).unwrap_err();
        assert_eq!(err, enc(ChainNotSupported { chainId: 99999 }));
    }

    #[test]
    fn test_send_message_insufficient_fee() {
        let (vm, mut hub, _owner) = setup();
        vm.set_value(U256::from(100));
        let target = Address::from([0xBBu8; 20]);
        let err = hub.send_message(84532, target, Bytes::from(vec![])).unwrap_err();
        assert_eq!(err, enc(InsufficientFee { required: U256::from(500), provided: U256::from(100) }));
    }

    #[test]
    fn test_send_message_multiple_increments_nonce() {
        let (vm, mut hub, _owner) = setup();
        let id1 = send_msg(&vm, &mut hub, 500);
        let id2 = send_msg(&vm, &mut hub, 500);
        assert_eq!(id1, U256::from(1));
        assert_eq!(id2, U256::from(2));
        assert_eq!(hub.message_nonce.get(), U256::from(2));
    }

    #[test]
    fn test_send_message_zero_target() {
        let (vm, mut hub, _owner) = setup();
        vm.set_value(U256::from(500));
        let err = hub.send_message(84532, Address::ZERO, Bytes::from(vec![])).unwrap_err();
        assert_eq!(err, enc(ZeroAddress {}));
    }

    // ── register_relayer / exit_relayer ─────────────────────────────────────

    #[test]
    fn test_register_relayer() {
        let (vm, mut hub, _owner) = setup();
        let relayer = vm.msg_sender();
        vm.set_value(U256::from(200));
        assert!(hub.register_relayer().is_ok());
        let (active, stake) = hub.get_relayer_info(relayer);
        assert!(active);
        assert_eq!(stake, U256::from(200));
    }

    #[test]
    fn test_register_relayer_insufficient_stake() {
        let (vm, mut hub, _owner) = setup();
        vm.set_value(U256::from(50));
        let err = hub.register_relayer().unwrap_err();
        assert_eq!(err, enc(InsufficientStake { required: U256::from(100), provided: U256::from(50) }));
    }

    #[test]
    fn test_register_relayer_accumulate_stake() {
        let (vm, mut hub, _owner) = setup();
        vm.set_value(U256::from(200));
        hub.register_relayer().unwrap();
        vm.set_value(U256::from(300));
        hub.register_relayer().unwrap();
        let relayer = vm.msg_sender();
        let (_active, stake) = hub.get_relayer_info(relayer);
        assert_eq!(stake, U256::from(500));
    }

    #[test]
    fn test_exit_relayer() {
        let (vm, mut hub, _owner) = setup();
        vm.set_value(U256::from(200));
        hub.register_relayer().unwrap();
        let relayer = vm.msg_sender();
        assert!(hub.exit_relayer().is_ok());
        let (active, stake) = hub.get_relayer_info(relayer);
        assert!(!active);
        assert_eq!(stake, U256::ZERO);
    }

    #[test]
    fn test_exit_relayer_not_active() {
        let (vm, mut hub, _owner) = setup();
        vm.set_sender(Address::from([0x99u8; 20]));
        let err = hub.exit_relayer().unwrap_err();
        assert_eq!(err, enc(RelayerNotActive { relayer: vm.msg_sender() }));
    }

    // ── confirm_delivery ────────────────────────────────────────────────────

    #[test]
    fn test_confirm_delivery() {
        let (vm, mut hub, _owner) = setup();
        fund_contract(&vm);

        let relayer = Address::from([0x10u8; 20]);
        vm.set_sender(relayer);
        vm.set_value(U256::from(200));
        hub.register_relayer().unwrap();

        vm.set_sender(Address::from([0xAAu8; 20]));
        let id = send_msg(&vm, &mut hub, 500);

        vm.set_sender(relayer);
        hub.confirm_delivery(id).unwrap();
        assert_eq!(hub.get_message_status(id).unwrap(), STATUS_RELAYED);
    }

    #[test]
    fn test_confirm_delivery_not_active_relayer() {
        let (vm, mut hub, _owner) = setup();
        vm.set_sender(Address::from([0xAAu8; 20]));
        let id = send_msg(&vm, &mut hub, 500);

        let relayer = Address::from([0x10u8; 20]);
        vm.set_sender(relayer);
        let err = hub.confirm_delivery(id).unwrap_err();
        assert_eq!(err, enc(RelayerNotActive { relayer }));
    }

    #[test]
    fn test_confirm_delivery_nonexistent_message() {
        let (vm, mut hub, _owner) = setup();
        let relayer = Address::from([0x10u8; 20]);
        vm.set_sender(relayer);
        vm.set_value(U256::from(200));
        hub.register_relayer().unwrap();

        let err = hub.confirm_delivery(U256::from(999)).unwrap_err();
        assert_eq!(err, enc(MessageNotFound { messageId: U256::from(999) }));
    }

    // ── challenge_message ───────────────────────────────────────────────────

    #[test]
    fn test_challenge_message() {
        let (vm, mut hub, _owner) = setup();
        fund_contract(&vm);

        let relayer = Address::from([0x10u8; 20]);
        vm.set_sender(relayer);
        vm.set_value(U256::from(200));
        hub.register_relayer().unwrap();

        vm.set_sender(Address::from([0xAAu8; 20]));
        let id = send_msg(&vm, &mut hub, 500);

        vm.set_sender(relayer);
        hub.confirm_delivery(id).unwrap();

        let challenger = Address::from([0xBBu8; 20]);
        vm.set_sender(challenger);
        hub.challenge_message(id).unwrap();
        assert_eq!(hub.get_message_status(id).unwrap(), STATUS_FAILED);
    }

    #[test]
    fn test_challenge_message_not_relayed() {
        let (vm, mut hub, _owner) = setup();
        let id = send_msg(&vm, &mut hub, 500);

        let err = hub.challenge_message(id).unwrap_err();
        assert_eq!(err, enc(CannotChallenge { messageId: id, status: STATUS_PENDING }));
    }

    #[test]
    fn test_challenge_message_expired() {
        let (vm, mut hub, _owner) = setup();
        fund_contract(&vm);

        let relayer = Address::from([0x10u8; 20]);
        vm.set_sender(relayer);
        vm.set_value(U256::from(200));
        hub.register_relayer().unwrap();

        vm.set_sender(Address::from([0xAAu8; 20]));
        let id = send_msg(&vm, &mut hub, 500);

        vm.set_sender(relayer);
        hub.confirm_delivery(id).unwrap();

        vm.set_block_timestamp(vm.block_timestamp() + 4000);

        let challenger = Address::from([0xBBu8; 20]);
        vm.set_sender(challenger);
        let err = hub.challenge_message(id).unwrap_err();
        assert_eq!(err, enc(ChallengeWindowExpired { messageId: id }));
    }

    // ── withdraw_protocol_fees ──────────────────────────────────────────────

    #[test]
    fn test_withdraw_protocol_fees() {
        let (vm, mut hub, owner) = setup();
        fund_contract(&vm);
        send_msg(&vm, &mut hub, 500);

        vm.set_sender(owner);
        hub.withdraw_protocol_fees().unwrap();
        assert_eq!(hub.protocol_fee_balance(), U256::ZERO);
    }

    #[test]
    fn test_withdraw_protocol_fees_not_owner() {
        let (vm, mut hub, _owner) = setup();
        send_msg(&vm, &mut hub, 500);

        let non_owner = Address::from([0x99u8; 20]);
        vm.set_sender(non_owner);
        let err = hub.withdraw_protocol_fees().unwrap_err();
        assert_eq!(err, enc(Unauthorized { caller: non_owner }));
    }

    #[test]
    fn test_withdraw_protocol_fees_nothing() {
        let (_vm, mut hub, _owner) = setup();
        assert!(hub.withdraw_protocol_fees().is_ok());
    }

    // ── get_message_status ──────────────────────────────────────────────────

    #[test]
    fn test_get_message_status_pending() {
        let (vm, mut hub, _owner) = setup();
        let id = send_msg(&vm, &mut hub, 500);
        assert_eq!(hub.get_message_status(id).unwrap(), STATUS_PENDING);
    }

    #[test]
    fn test_get_message_status_not_found() {
        let (_vm, hub, _owner) = setup();
        let err = hub.get_message_status(U256::from(999)).unwrap_err();
        assert_eq!(err, enc(MessageNotFound { messageId: U256::from(999) }));
    }

    // ── view functions ──────────────────────────────────────────────────────

    #[test]
    fn test_is_active_relayer() {
        let (vm, mut hub, _owner) = setup();
        let relayer = vm.msg_sender();

        assert!(!hub.get_relayer_info(relayer).0);
        vm.set_value(U256::from(200));
        hub.register_relayer().unwrap();
        assert!(hub.get_relayer_info(relayer).0);
    }

    #[test]
    fn test_get_relayer_info() {
        let (vm, mut hub, _owner) = setup();
        let relayer = vm.msg_sender();

        let (active, stake) = hub.get_relayer_info(relayer);
        assert!(!active);
        assert_eq!(stake, U256::ZERO);

        vm.set_value(U256::from(200));
        hub.register_relayer().unwrap();

        let (active, stake) = hub.get_relayer_info(relayer);
        assert!(active);
        assert_eq!(stake, U256::from(200));
    }

    #[test]
    fn test_initial_view_values() {
        let vm = TestVM::new();
        let hub = MessageHub::from(&vm);

        assert_eq!(hub.owner.get(), Address::ZERO);
        assert_eq!(hub.min_stake(), U256::ZERO);
        assert_eq!(hub.challenge_period.get(), U256::ZERO);
        assert_eq!(hub.message_nonce.get(), U256::ZERO);
        assert_eq!(hub.protocol_fee_balance(), U256::ZERO);
    }

    // ── full lifecycle ──────────────────────────────────────────────────────

    #[test]
    fn test_full_lifecycle_pending_relayed_failed() {
        let (vm, mut hub, _owner) = setup();
        fund_contract(&vm);

        let relayer = Address::from([0x10u8; 20]);
        vm.set_sender(relayer);
        vm.set_value(U256::from(200));
        hub.register_relayer().unwrap();

        vm.set_sender(Address::from([0xAAu8; 20]));
        let id = send_msg(&vm, &mut hub, 500);
        assert_eq!(hub.get_message_status(id).unwrap(), STATUS_PENDING);

        vm.set_sender(relayer);
        hub.confirm_delivery(id).unwrap();
        assert_eq!(hub.get_message_status(id).unwrap(), STATUS_RELAYED);

        let challenger = Address::from([0xBBu8; 20]);
        vm.set_sender(challenger);
        hub.challenge_message(id).unwrap();
        assert_eq!(hub.get_message_status(id).unwrap(), STATUS_FAILED);
    }

    // ── ownership transfer ─────────────────────────────────────────────────

    #[test]
    fn test_transfer_ownership() {
        let (_vm, mut hub, _owner) = setup();
        let new_owner = Address::from([0x22u8; 20]);
        hub.transfer_ownership(new_owner).unwrap();
        assert_eq!(hub.owner.get(), new_owner);
    }

    #[test]
    fn test_transfer_ownership_not_owner() {
        let (vm, mut hub, _owner) = setup();
        vm.set_sender(Address::from([0x99u8; 20]));
        let err = hub.transfer_ownership(Address::from([0x22u8; 20])).unwrap_err();
        assert_eq!(err, enc(Unauthorized { caller: Address::from([0x99u8; 20]) }));
    }
}
