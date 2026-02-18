//! ArbiLink MessageHub – cross-chain messaging hub on Arbitrum Stylus
//!
//! Key design:
//!   • Optimistic delivery: relayers confirm messages, subject to a 5-min
//!     challenge window before finality.
//!   • Relayers stake ETH; fraudulent confirmations result in stake slashing.
//!   • Any EVM chain can be registered as a destination.

#![cfg_attr(not(feature = "export-abi"), no_main)]
extern crate alloc;

use alloc::vec::Vec;
use stylus_sdk::{
    alloy_primitives::{Address, U256, U8, U32},
    alloy_sol_types::{sol, SolError, SolEvent},
    call::transfer::transfer_eth,
    prelude::*,
};

// ── Events ────────────────────────────────────────────────────────────────────

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

    event MessageChallenged(
        uint256 indexed messageId,
        address indexed challenger,
        bool    relayerSlashed
    );

    event RelayerRegistered(
        address indexed relayer,
        uint256 stake
    );

    event RelayerExited(
        address indexed relayer,
        uint256 returned
    );

    event ChainAdded(
        uint32  indexed chainId,
        address receiver,
        uint256 baseFee
    );

    event FeesWithdrawn(
        address indexed owner,
        uint256 amount
    );
}

// ── Errors ────────────────────────────────────────────────────────────────────

sol! {
    error ChainNotSupported(uint32 chainId);
    error InsufficientFee(uint256 required, uint256 provided);
    error MessageNotFound(uint256 messageId);
    error ChallengeExpired(uint256 deadline);
    error ChallengeWindowOpen(uint256 deadline);
    error InsufficientStake(uint256 required, uint256 provided);
    error Unauthorized(address caller);
    error InvalidProof();
    error RelayerNotActive(address relayer);
    error WrongStatus(uint8 expected, uint8 actual);
    error TransferFailed();
    error ZeroAddress();
    error AlreadyInitialized();
}

// ── Storage ───────────────────────────────────────────────────────────────────
// sol_storage! uses Solidity field-declaration order: `type name;`

sol_storage! {
    /// Per-message record.
    pub struct StoredMessage {
        address sender;
        uint32  destination_chain;
        address target;
        bytes   data;
        uint256 timestamp;
        uint256 fee_paid;
        uint8   status;
        address relayer;
    }

    /// Per-chain configuration.
    pub struct StoredChainConfig {
        bool    enabled;
        address receiver_address;
        uint256 base_fee;
    }

    /// Per-relayer info.
    pub struct StoredRelayerInfo {
        bool    active;
        uint256 total_relayed;
        uint256 successful;
        uint256 slashed;
        uint256 stake;
    }

    /// Per-challenge record.
    pub struct StoredChallenge {
        bool    exists;
        address challenger;
        uint256 deadline;
        bool    resolved;
    }

    #[entrypoint]
    pub struct MessageHub {
        address owner;
        uint256 message_nonce;
        mapping(uint256 => StoredMessage) messages;
        mapping(uint32 => StoredChainConfig) supported_chains;
        uint256 chain_count;
        mapping(address => StoredRelayerInfo) relayers;
        uint256 min_stake;
        uint256 protocol_fee_balance;
        uint256 challenge_period;
        mapping(uint256 => StoredChallenge) challenges;
    }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_PENDING: u8 = 0;
const STATUS_RELAYED: u8 = 1;
const STATUS_CONFIRMED: u8 = 2;
const STATUS_FAILED: u8 = 3;

const RELAYER_REWARD_BPS: u64 = 8_000;
const CHALLENGER_REWARD_BPS: u64 = 1_000;

fn encode_err<E: SolError>(err: E) -> Vec<u8> {
    err.abi_encode()
}

/// Convert U8 (Uint<8,1>) → u8 via ruint's `.to::<u8>()`.
#[inline]
fn u8_val(v: U8) -> u8 {
    v.to::<u8>()
}

/// Convert U32 (Uint<32,1>) → u32 via ruint's `.to::<u32>()`.
#[inline]
fn u32_val(v: U32) -> u32 {
    v.to::<u32>()
}

// ── Public interface ──────────────────────────────────────────────────────────

#[public]
impl MessageHub {
    // ── Initializer ──────────────────────────────────────────────────────────

    pub fn initialize(
        &mut self,
        min_stake: U256,
        challenge_period: U256,
    ) -> Result<(), Vec<u8>> {
        if self.owner.get() != Address::ZERO {
            return Err(encode_err(AlreadyInitialized {}));
        }
        self.owner.set(self.vm().msg_sender());
        self.min_stake.set(min_stake);
        self.challenge_period.set(challenge_period);
        Ok(())
    }

    // ── Core messaging ───────────────────────────────────────────────────────

    /// Send a cross-chain message. Returns the message ID.
    #[payable]
    pub fn send_message(
        &mut self,
        destination_chain: u32,
        target: Address,
        data: Vec<u8>,
    ) -> Result<U256, Vec<u8>> {
        let chain_key = U32::from(destination_chain);

        // Chain must be enabled
        if !self.supported_chains.getter(chain_key).enabled.get() {
            return Err(encode_err(ChainNotSupported { chainId: destination_chain }));
        }

        // Fee check
        let required_fee = self.supported_chains.getter(chain_key).base_fee.get();
        let provided = self.vm().msg_value();
        if provided < required_fee {
            return Err(encode_err(InsufficientFee { required: required_fee, provided }));
        }

        // Assign ID
        let id = self.message_nonce.get() + U256::from(1u8);
        self.message_nonce.set(id);

        // Store message
        let sender = self.vm().msg_sender();
        let ts = U256::from(self.vm().block_timestamp());
        {
            let mut m = self.messages.setter(id);
            m.sender.set(sender);
            m.destination_chain.set(chain_key);
            m.target.set(target);
            m.data.set_bytes(&data);
            m.timestamp.set(ts);
            m.fee_paid.set(provided);
            m.status.set(U8::from(STATUS_PENDING));
            m.relayer.set(Address::ZERO);
        }

        // Accumulate fee
        self.protocol_fee_balance
            .set(self.protocol_fee_balance.get() + provided);

        self.vm().log(MessageSent {
            messageId: id,
            sender,
            destinationChain: destination_chain,
            target,
            data: data.into(),
            fee: provided,
        });

        Ok(id)
    }

    /// Relayer confirms execution on destination. Starts challenge window.
    pub fn confirm_delivery(
        &mut self,
        message_id: U256,
        execution_proof: Vec<u8>,
    ) -> Result<(), Vec<u8>> {
        let relayer = self.vm().msg_sender();

        if !self.relayers.getter(relayer).active.get() {
            return Err(encode_err(RelayerNotActive { relayer }));
        }

        if self.messages.getter(message_id).timestamp.get() == U256::ZERO {
            return Err(encode_err(MessageNotFound { messageId: message_id }));
        }

        let current_status = u8_val(self.messages.getter(message_id).status.get());
        if current_status != STATUS_PENDING {
            return Err(encode_err(WrongStatus {
                expected: STATUS_PENDING,
                actual: current_status,
            }));
        }

        let dest_chain = u32_val(self.messages.getter(message_id).destination_chain.get());
        let receiver = self
            .supported_chains
            .getter(U32::from(dest_chain))
            .receiver_address
            .get();
        if !verify_execution_proof(message_id, dest_chain, &execution_proof, receiver) {
            return Err(encode_err(InvalidProof {}));
        }

        let fee_paid = self.messages.getter(message_id).fee_paid.get();
        {
            let mut m = self.messages.setter(message_id);
            m.status.set(U8::from(STATUS_RELAYED));
            m.relayer.set(relayer);
        }

        let deadline = U256::from(self.vm().block_timestamp()) + self.challenge_period.get();
        {
            let mut ch = self.challenges.setter(message_id);
            ch.exists.set(true);
            ch.deadline.set(deadline);
            ch.resolved.set(false);
        }

        let reward = fee_paid * U256::from(RELAYER_REWARD_BPS) / U256::from(10_000u64);
        self.protocol_fee_balance
            .set(self.protocol_fee_balance.get() - reward);

        {
            let prev_relayed = self.relayers.getter(relayer).total_relayed.get();
            self.relayers
                .setter(relayer)
                .total_relayed
                .set(prev_relayed + U256::from(1u8));
        }

        transfer_eth(self.vm(), relayer, reward)
            .map_err(|_| encode_err(TransferFailed {}))?;

        self.vm().log(MessageConfirmed {
            messageId: message_id,
            relayer,
            timestamp: U256::from(self.vm().block_timestamp()),
        });

        Ok(())
    }

    /// Challenge a relayed message within the challenge window.
    pub fn challenge_message(
        &mut self,
        message_id: U256,
        proof_of_fraud: Vec<u8>,
    ) -> Result<(), Vec<u8>> {
        let challenger = self.vm().msg_sender();

        if !self.challenges.getter(message_id).exists.get() {
            return Err(encode_err(MessageNotFound { messageId: message_id }));
        }

        let deadline = self.challenges.getter(message_id).deadline.get();
        if self.challenges.getter(message_id).resolved.get() {
            return Err(encode_err(ChallengeExpired { deadline }));
        }
        if U256::from(self.vm().block_timestamp()) > deadline {
            return Err(encode_err(ChallengeExpired { deadline }));
        }

        let status = u8_val(self.messages.getter(message_id).status.get());
        if status != STATUS_RELAYED {
            return Err(encode_err(WrongStatus {
                expected: STATUS_RELAYED,
                actual: status,
            }));
        }

        let dest_chain = u32_val(self.messages.getter(message_id).destination_chain.get());
        let receiver = self
            .supported_chains
            .getter(U32::from(dest_chain))
            .receiver_address
            .get();
        if !verify_fraud_proof(message_id, dest_chain, &proof_of_fraud, receiver) {
            return Err(encode_err(InvalidProof {}));
        }

        let relayer = self.messages.getter(message_id).relayer.get();
        let stake = self.relayers.getter(relayer).stake.get();
        let prev_slashed = self.relayers.getter(relayer).slashed.get();
        {
            let mut ri = self.relayers.setter(relayer);
            ri.stake.set(U256::ZERO);
            ri.active.set(false);
            ri.slashed.set(prev_slashed + stake);
        }

        let challenger_reward =
            stake * U256::from(CHALLENGER_REWARD_BPS) / U256::from(10_000u64);
        self.protocol_fee_balance
            .set(self.protocol_fee_balance.get() + stake - challenger_reward);

        self.messages.setter(message_id).status.set(U8::from(STATUS_FAILED));
        {
            let mut ch = self.challenges.setter(message_id);
            ch.resolved.set(true);
            ch.challenger.set(challenger);
        }

        transfer_eth(self.vm(), challenger, challenger_reward)
            .map_err(|_| encode_err(TransferFailed {}))?;

        self.vm().log(MessageChallenged {
            messageId: message_id,
            challenger,
            relayerSlashed: true,
        });

        Ok(())
    }

    /// Finalize a message after the challenge window closes without challenge.
    pub fn finalize_message(&mut self, message_id: U256) -> Result<(), Vec<u8>> {
        if !self.challenges.getter(message_id).exists.get() {
            return Err(encode_err(MessageNotFound { messageId: message_id }));
        }

        let deadline = self.challenges.getter(message_id).deadline.get();
        if self.challenges.getter(message_id).resolved.get() {
            return Err(encode_err(WrongStatus {
                expected: STATUS_RELAYED,
                actual: STATUS_CONFIRMED,
            }));
        }
        if U256::from(self.vm().block_timestamp()) <= deadline {
            return Err(encode_err(ChallengeWindowOpen { deadline }));
        }

        let status = u8_val(self.messages.getter(message_id).status.get());
        if status != STATUS_RELAYED {
            return Err(encode_err(WrongStatus {
                expected: STATUS_RELAYED,
                actual: status,
            }));
        }

        self.messages
            .setter(message_id)
            .status
            .set(U8::from(STATUS_CONFIRMED));

        let relayer = self.messages.getter(message_id).relayer.get();
        let prev_successful = self.relayers.getter(relayer).successful.get();
        self.relayers
            .setter(relayer)
            .successful
            .set(prev_successful + U256::from(1u8));

        self.challenges.setter(message_id).resolved.set(true);

        Ok(())
    }

    // ── Relayer management ───────────────────────────────────────────────────

    #[payable]
    pub fn register_relayer(&mut self) -> Result<(), Vec<u8>> {
        let relayer = self.vm().msg_sender();
        let provided = self.vm().msg_value();
        let required = self.min_stake.get();
        if provided < required {
            return Err(encode_err(InsufficientStake { required, provided }));
        }
        let prev_stake = self.relayers.getter(relayer).stake.get();
        {
            let mut ri = self.relayers.setter(relayer);
            ri.active.set(true);
            ri.stake.set(prev_stake + provided);
        }
        self.vm().log(RelayerRegistered { relayer, stake: provided });
        Ok(())
    }

    pub fn exit_relayer(&mut self) -> Result<(), Vec<u8>> {
        let relayer = self.vm().msg_sender();
        if !self.relayers.getter(relayer).active.get() {
            return Err(encode_err(RelayerNotActive { relayer }));
        }
        let stake = self.relayers.getter(relayer).stake.get();
        {
            let mut ri = self.relayers.setter(relayer);
            ri.stake.set(U256::ZERO);
            ri.active.set(false);
        }
        transfer_eth(self.vm(), relayer, stake)
            .map_err(|_| encode_err(TransferFailed {}))?;
        self.vm().log(RelayerExited { relayer, returned: stake });
        Ok(())
    }

    // ── Chain management (owner only) ────────────────────────────────────────

    pub fn add_chain(
        &mut self,
        chain_id: u32,
        receiver_address: Address,
        base_fee: U256,
    ) -> Result<(), Vec<u8>> {
        self.only_owner()?;
        if receiver_address == Address::ZERO {
            return Err(encode_err(ZeroAddress {}));
        }
        let chain_key = U32::from(chain_id);
        let is_new = !self.supported_chains.getter(chain_key).enabled.get();
        {
            let mut c = self.supported_chains.setter(chain_key);
            c.enabled.set(true);
            c.receiver_address.set(receiver_address);
            c.base_fee.set(base_fee);
        }
        if is_new {
            self.chain_count.set(self.chain_count.get() + U256::from(1u8));
        }
        self.vm().log(ChainAdded {
            chainId: chain_id,
            receiver: receiver_address,
            baseFee: base_fee,
        });
        Ok(())
    }

    pub fn disable_chain(&mut self, chain_id: u32) -> Result<(), Vec<u8>> {
        self.only_owner()?;
        self.supported_chains
            .setter(U32::from(chain_id))
            .enabled
            .set(false);
        Ok(())
    }

    // ── Fee management (owner only) ──────────────────────────────────────────

    pub fn withdraw_fees(&mut self, amount: U256) -> Result<(), Vec<u8>> {
        self.only_owner()?;
        let balance = self.protocol_fee_balance.get();
        if amount > balance {
            return Err(encode_err(InsufficientFee { required: amount, provided: balance }));
        }
        self.protocol_fee_balance.set(balance - amount);
        let owner = self.owner.get();
        transfer_eth(self.vm(), owner, amount)
            .map_err(|_| encode_err(TransferFailed {}))?;
        self.vm().log(FeesWithdrawn { owner, amount });
        Ok(())
    }

    pub fn transfer_ownership(&mut self, new_owner: Address) -> Result<(), Vec<u8>> {
        self.only_owner()?;
        if new_owner == Address::ZERO {
            return Err(encode_err(ZeroAddress {}));
        }
        self.owner.set(new_owner);
        Ok(())
    }

    // ── View functions ───────────────────────────────────────────────────────

    /// Message status: 0=Pending 1=Relayed 2=Confirmed 3=Failed
    pub fn get_message_status(&self, message_id: U256) -> Result<u8, Vec<u8>> {
        if self.messages.getter(message_id).timestamp.get() == U256::ZERO {
            return Err(encode_err(MessageNotFound { messageId: message_id }));
        }
        Ok(u8_val(self.messages.getter(message_id).status.get()))
    }

    pub fn get_message_sender(&self, message_id: U256) -> Result<Address, Vec<u8>> {
        if self.messages.getter(message_id).timestamp.get() == U256::ZERO {
            return Err(encode_err(MessageNotFound { messageId: message_id }));
        }
        Ok(self.messages.getter(message_id).sender.get())
    }

    pub fn get_message_relayer(&self, message_id: U256) -> Result<Address, Vec<u8>> {
        if self.messages.getter(message_id).timestamp.get() == U256::ZERO {
            return Err(encode_err(MessageNotFound { messageId: message_id }));
        }
        Ok(self.messages.getter(message_id).relayer.get())
    }

    pub fn get_message_fee(&self, message_id: U256) -> Result<U256, Vec<u8>> {
        if self.messages.getter(message_id).timestamp.get() == U256::ZERO {
            return Err(encode_err(MessageNotFound { messageId: message_id }));
        }
        Ok(self.messages.getter(message_id).fee_paid.get())
    }

    pub fn get_message_destination(&self, message_id: U256) -> Result<u32, Vec<u8>> {
        if self.messages.getter(message_id).timestamp.get() == U256::ZERO {
            return Err(encode_err(MessageNotFound { messageId: message_id }));
        }
        Ok(u32_val(self.messages.getter(message_id).destination_chain.get()))
    }

    pub fn calculate_fee(&self, destination_chain: u32) -> U256 {
        self.supported_chains
            .getter(U32::from(destination_chain))
            .base_fee
            .get()
    }

    pub fn is_active_relayer(&self, relayer: Address) -> bool {
        self.relayers.getter(relayer).active.get()
    }

    pub fn relayer_stake(&self, relayer: Address) -> U256 {
        self.relayers.getter(relayer).stake.get()
    }

    pub fn message_count(&self) -> U256 {
        self.message_nonce.get()
    }

    pub fn owner(&self) -> Address {
        self.owner.get()
    }

    pub fn min_stake(&self) -> U256 {
        self.min_stake.get()
    }

    pub fn challenge_period(&self) -> U256 {
        self.challenge_period.get()
    }

    pub fn protocol_fee_balance(&self) -> U256 {
        self.protocol_fee_balance.get()
    }

    pub fn chain_info(&self, chain_id: u32) -> (bool, Address, U256) {
        let c = self.supported_chains.getter(U32::from(chain_id));
        (c.enabled.get(), c.receiver_address.get(), c.base_fee.get())
    }

    pub fn challenge_deadline(&self, message_id: U256) -> U256 {
        self.challenges.getter(message_id).deadline.get()
    }
}

// ── Private helpers ───────────────────────────────────────────────────────────

impl MessageHub {
    fn only_owner(&self) -> Result<(), Vec<u8>> {
        let caller = self.vm().msg_sender();
        if caller != self.owner.get() {
            return Err(encode_err(Unauthorized { caller }));
        }
        Ok(())
    }
}

// ── Proof stubs ───────────────────────────────────────────────────────────────
// Hackathon: accept ≥ 65-byte proof with non-zero first byte.
// Production: ecrecover against destination receiver's signing key.

fn verify_execution_proof(
    _message_id: U256,
    _destination_chain: u32,
    proof: &[u8],
    _receiver: Address,
) -> bool {
    proof.len() >= 65 && proof[0] != 0
}

fn verify_fraud_proof(
    _message_id: U256,
    _destination_chain: u32,
    proof: &[u8],
    _receiver: Address,
) -> bool {
    proof.len() >= 65 && proof[0] != 0
}

#[cfg(feature = "export-abi")]
pub fn export_abi_string() -> &'static str {
    ""
}
