//! ArbiLink MessageHub – cross-chain messaging hub on Arbitrum Stylus

#![cfg_attr(not(feature = "export-abi"), no_main)]
extern crate alloc;

use alloc::vec::Vec;
use stylus_sdk::{
    alloy_primitives::{Address, U256, U8, U32},
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
    event MessageConfirmed(
        uint256 indexed messageId,
        address indexed relayer,
        uint256 timestamp
    );
    event RelayerRegistered(address indexed relayer, uint256 stake);
    event RelayerExited(address indexed relayer, uint256 returned);
    event ChainAdded(uint32 indexed chainId, address receiver, uint256 baseFee);

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
    }
    pub struct StoredChainConfig {
        bool    enabled;
        address receiver_address;
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

const STATUS_PENDING: u8   = 0;
const STATUS_CONFIRMED: u8 = 1;
const RELAYER_REWARD_BPS: u64 = 8_000;

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
    pub fn send_message(&mut self, destination_chain: u32, target: Address, data: Vec<u8>) -> Result<U256, Vec<u8>> {
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
        }
        self.protocol_fee_balance.set(self.protocol_fee_balance.get() + val);
        self.vm().log(MessageSent { messageId: id, sender, destinationChain: destination_chain, target, data: data.into(), fee: val });
        Ok(id)
    }

    pub fn confirm_delivery(&mut self, message_id: U256, _proof: Vec<u8>) -> Result<(), Vec<u8>> {
        let relayer = self.vm().msg_sender();
        if !self.relayers.getter(relayer).active.get() { return Err(enc(RelayerNotActive { relayer })); }
        let ts = self.messages.getter(message_id).timestamp.get();
        if ts == U256::ZERO { return Err(enc(MessageNotFound { messageId: message_id })); }
        let st = self.messages.getter(message_id).status.get().to::<u8>();
        if st != STATUS_PENDING { return Err(enc(AlreadyRelayed { messageId: message_id })); }
        let fee = self.messages.getter(message_id).fee_paid.get();
        {
            let mut m = self.messages.setter(message_id);
            m.status.set(U8::from(STATUS_CONFIRMED));
            m.relayer.set(relayer);
        }
        let reward = fee * U256::from(RELAYER_REWARD_BPS) / U256::from(10_000u64);
        self.protocol_fee_balance.set(self.protocol_fee_balance.get() - reward);
        transfer_eth(self.vm(), relayer, reward).map_err(|_| enc(TransferFailed {}))?;
        self.vm().log(MessageConfirmed { messageId: message_id, relayer, timestamp: U256::from(self.vm().block_timestamp()) });
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

    pub fn calculate_fee(&self, destination_chain: u32) -> U256 {
        self.supported_chains.getter(U32::from(destination_chain)).base_fee.get()
    }

    pub fn is_active_relayer(&self, r: Address) -> bool { self.relayers.getter(r).active.get() }
    pub fn message_count(&self) -> U256                 { self.message_nonce.get() }
    pub fn owner(&self) -> Address                      { self.owner.get() }
    pub fn min_stake(&self) -> U256                     { self.min_stake.get() }
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
