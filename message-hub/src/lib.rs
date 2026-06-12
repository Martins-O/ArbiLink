//! ArbiLink MessageHub – cross-chain messaging hub on Arbitrum Stylus
//!
//! ## Message lifecycle
//!
//! ```text
//! PENDING ──► RELAYED ──► CONFIRMED
//!                 │
//!                 └──► FAILED  (successful challenge)
//! ```
//!
//! | Status | Name       | Meaning                                      |
//! |--------|------------|----------------------------------------------|
//! | 0      | PENDING    | Sent, awaiting relayer delivery              |
//! | 1      | RELAYED    | Delivered, in challenge window               |
//! | 2      | CONFIRMED  | Finalized after challenge window expired     |
//! | 3      | FAILED     | Relayer was slashed via fraud proof          |

#![cfg_attr(not(feature = "export-abi"), no_main)]
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
    event MessageRelayed(
        uint256 indexed messageId,
        address indexed relayer,
        uint256 deadline
    );
    event MessageConfirmed(
        uint256 indexed messageId,
        address indexed relayer,
        uint256 timestamp
    );
    event MessageChallenged(
        uint256 indexed messageId,
        address indexed challenger,
        address indexed relayer
    );
    event RelayerRegistered(address indexed relayer, uint256 stake);
    event RelayerExited(address indexed relayer, uint256 returned);
    event ChainAdded(uint32 indexed chainId, address receiver, uint256 baseFee);
    event FeesWithdrawn(address indexed owner, uint256 amount);

    error ChainNotSupported(uint32 chainId);
    error InsufficientFee(uint256 required, uint256 provided);
    error MessageNotFound(uint256 messageId);
    error InsufficientStake(uint256 required, uint256 provided);
    error Unauthorized(address caller);
    error RelayerNotActive(address relayer);
    error AlreadyRelayed(uint256 messageId);
    error TransferFailed();
    error ZeroAddress();
    error AlreadyInitialized();
    error ChallengeWindowNotExpired(uint256 messageId, uint256 deadline);
    error ChallengeWindowExpired(uint256 messageId);
    error CannotChallenge(uint256 messageId, uint8 status);
    error NoStakeToSlash(address relayer);
    error NothingToWithdraw();
}

sol_storage! {
    pub struct StoredMessage {
        address sender;
        uint32  destination_chain;
        address target;
        uint256 timestamp;
        uint256 fee_paid;
        uint8   status;
        address relayer;
        uint256 challenge_deadline;
    }
    pub struct StoredChainConfig {
        bool    enabled;
        address receiver_address;
        uint256 base_fee;
    }
    pub struct StoredRelayerInfo {
        bool    active;
        uint256 stake;
        uint256 successful_deliveries;
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
const STATUS_CONFIRMED: u8  = 2;
const STATUS_FAILED: u8     = 3;
const RELAYER_REWARD_BPS: u64    = 8_000; // 80% of fee
const CHALLENGER_REWARD_BPS: u64 = 1_000; // 10% of slashed stake

fn enc<E: SolError>(e: E) -> Vec<u8> { e.abi_encode() }

#[public]
impl MessageHub {
    pub fn initialize(&mut self, min_stake: U256, challenge_period: U256) -> Result<(), Vec<u8>> {
        if self.owner.get() != Address::ZERO { return Err(enc(AlreadyInitialized {})); }
        self.owner.set(self.vm().msg_sender());
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
        let req = self.supported_chains.getter(ck).base_fee.get();
        let val = self.vm().msg_value();
        if val < req { return Err(enc(InsufficientFee { required: req, provided: val })); }
        let id = self.message_nonce.get() + U256::from(1u8);
        self.message_nonce.set(id);
        let sender = self.vm().msg_sender();
        let ts = U256::from(self.vm().block_timestamp());
        {
            let mut m = self.messages.setter(id);
            m.sender.set(sender);
            m.destination_chain.set(ck);
            m.target.set(target);
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

    pub fn confirm_delivery(&mut self, message_id: U256, _proof: Bytes) -> Result<(), Vec<u8>> {
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
        transfer_eth(self.vm(), relayer, reward).map_err(|_| enc(TransferFailed {}))?;
        self.vm().log(MessageRelayed { messageId: message_id, relayer, deadline });
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
        if stake == U256::ZERO { return Err(enc(NoStakeToSlash { relayer: relayer_addr })); }
        {
            let mut ri = self.relayers.setter(relayer_addr);
            ri.active.set(false);
            ri.stake.set(U256::ZERO);
        }
        let challenger_reward = stake * U256::from(CHALLENGER_REWARD_BPS) / U256::from(10_000u64);
        let remainder = stake - challenger_reward;
        self.protocol_fee_balance.set(self.protocol_fee_balance.get() + remainder);
        transfer_eth(self.vm(), challenger, challenger_reward).map_err(|_| enc(TransferFailed {}))?;
        self.vm().log(MessageChallenged { messageId: message_id, challenger, relayer: relayer_addr });
        Ok(())
    }

    pub fn finalize_message(&mut self, message_id: U256) -> Result<(), Vec<u8>> {
        let ts = self.messages.getter(message_id).timestamp.get();
        if ts == U256::ZERO { return Err(enc(MessageNotFound { messageId: message_id })); }
        let st = self.messages.getter(message_id).status.get().to::<u8>();
        if st != STATUS_RELAYED { return Err(enc(AlreadyRelayed { messageId: message_id })); }
        let deadline = self.messages.getter(message_id).challenge_deadline.get();
        let now = U256::from(self.vm().block_timestamp());
        if now <= deadline { return Err(enc(ChallengeWindowNotExpired { messageId: message_id, deadline })); }
        let relayer_addr = self.messages.getter(message_id).relayer.get();
        {
            let mut m = self.messages.setter(message_id);
            m.status.set(U8::from(STATUS_CONFIRMED));
        }
        let count = self.relayers.getter(relayer_addr).successful_deliveries.get();
        {
            let mut ri = self.relayers.setter(relayer_addr);
            ri.successful_deliveries.set(count + U256::from(1u8));
        }
        self.vm().log(MessageConfirmed { messageId: message_id, relayer: relayer_addr, timestamp: U256::from(self.vm().block_timestamp()) });
        Ok(())
    }

    pub fn withdraw_protocol_fees(&mut self) -> Result<(), Vec<u8>> {
        self.only_owner()?;
        let balance = self.protocol_fee_balance.get();
        if balance == U256::ZERO { return Err(enc(NothingToWithdraw {})); }
        self.protocol_fee_balance.set(U256::ZERO);
        transfer_eth(self.vm(), self.owner.get(), balance).map_err(|_| enc(TransferFailed {}))?;
        self.vm().log(FeesWithdrawn { owner: self.owner.get(), amount: balance });
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
        self.vm().log(RelayerRegistered { relayer: r, stake: v });
        Ok(())
    }

    pub fn exit_relayer(&mut self) -> Result<(), Vec<u8>> {
        let r = self.vm().msg_sender();
        if !self.relayers.getter(r).active.get() { return Err(enc(RelayerNotActive { relayer: r })); }
        let s = self.relayers.getter(r).stake.get();
        { let mut ri = self.relayers.setter(r); ri.stake.set(U256::ZERO); ri.active.set(false); }
        transfer_eth(self.vm(), r, s).map_err(|_| enc(TransferFailed {}))?;
        self.vm().log(RelayerExited { relayer: r, returned: s });
        Ok(())
    }

    pub fn add_chain(&mut self, chain_id: u32, receiver_address: Address, base_fee: U256) -> Result<(), Vec<u8>> {
        self.only_owner()?;
        if receiver_address == Address::ZERO { return Err(enc(ZeroAddress {})); }
        let ck = U32::from(chain_id);
        { let mut c = self.supported_chains.setter(ck); c.enabled.set(true); c.receiver_address.set(receiver_address); c.base_fee.set(base_fee); }
        self.vm().log(ChainAdded { chainId: chain_id, receiver: receiver_address, baseFee: base_fee });
        Ok(())
    }

    pub fn get_message_status(&self, id: U256) -> Result<u8, Vec<u8>> {
        if self.messages.getter(id).timestamp.get() == U256::ZERO { return Err(enc(MessageNotFound { messageId: id })); }
        Ok(self.messages.getter(id).status.get().to::<u8>())
    }

    pub fn get_relayer_info(&self, r: Address) -> (bool, U256, U256) {
        let ri = self.relayers.getter(r);
        (ri.active.get(), ri.stake.get(), ri.successful_deliveries.get())
    }

    pub fn calculate_fee(&self, destination_chain: u32) -> U256 {
        self.supported_chains.getter(U32::from(destination_chain)).base_fee.get()
    }

    pub fn is_active_relayer(&self, r: Address) -> bool { self.relayers.getter(r).active.get() }
    pub fn message_count(&self) -> U256                 { self.message_nonce.get() }
    pub fn owner(&self) -> Address                      { self.owner.get() }
    pub fn min_stake(&self) -> U256                     { self.min_stake.get() }
    pub fn protocol_fee_balance(&self) -> U256          { self.protocol_fee_balance.get() }
    pub fn challenge_period(&self) -> U256              { self.challenge_period.get() }
}

impl MessageHub {
    fn only_owner(&self) -> Result<(), Vec<u8>> {
        let c = self.vm().msg_sender();
        if c != self.owner.get() { return Err(enc(Unauthorized { caller: c })); }
        Ok(())
    }
}

#[cfg(feature = "export-abi")]
pub fn export_abi_string() -> &'static str { "" }
