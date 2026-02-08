// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ECDSA} from "./ECDSA.sol";

/**
 * @title  ArbiLinkReceiver
 * @notice Deployed on destination chains (ETH, Base, etc.).
 *         Receives messages relayed from the ArbiLink MessageHub on Arbitrum,
 *         verifies them, and executes arbitrary calls on behalf of the sender.
 *
 * Security model:
 *  - Only authorised relayers (set by owner) may deliver messages.
 *  - Every message hash is stored to prevent replay.
 *  - Message authenticity is verified via ECDSA signature from the hub's
 *    designated signing key.
 */
contract ArbiLinkReceiver {
    // ── State ──────────────────────────────────────────────────────────────────

    address public immutable messageHub; // MessageHub address on Arbitrum
    address public owner;
    address public hubSigningKey;        // key that signs execution proofs

    mapping(address => bool)    public authorizedRelayers;
    mapping(bytes32 => bool)    public processedMessages;
    mapping(bytes32 => Receipt) public receipts;

    uint256 public totalExecuted;
    uint256 public totalFailed;

    // ── Types ──────────────────────────────────────────────────────────────────

    struct Message {
        uint256 id;
        address sender;
        address target;
        bytes   data;
        uint32  sourceChain;   // always 421614 (Arbitrum Sepolia)
    }

    struct Receipt {
        bool    executed;
        bool    success;
        uint256 timestamp;
    }

    // ── Events ─────────────────────────────────────────────────────────────────

    event MessageReceived(
        uint256 indexed messageId,
        address indexed sender,
        address indexed target,
        bool    success
    );
    event RelayerAuthorized(address indexed relayer, bool authorized);
    event HubSigningKeyUpdated(address indexed newKey);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ── Errors ─────────────────────────────────────────────────────────────────

    error NotRelayer();
    error AlreadyProcessed(bytes32 msgHash);
    error InvalidSignature();
    error InvalidTarget();
    error Unauthorized();

    // ── Modifiers ──────────────────────────────────────────────────────────────

    modifier onlyRelayer() {
        if (!authorizedRelayers[msg.sender]) revert NotRelayer();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    // ── Constructor ────────────────────────────────────────────────────────────

    constructor(address _messageHub, address _hubSigningKey) {
        messageHub     = _messageHub;
        hubSigningKey  = _hubSigningKey;
        owner          = msg.sender;
        // deployer is the first authorised relayer
        authorizedRelayers[msg.sender] = true;
        emit RelayerAuthorized(msg.sender, true);
    }

    // ── Core: receive and execute ──────────────────────────────────────────────

    /**
     * @notice Execute a message relayed from the ArbiLink MessageHub.
     *
     * @param message  The cross-chain message struct.
     * @param proof    65-byte ECDSA signature from the MessageHub signing key
     *                 over keccak256(abi.encode(message)).
     * @return success Whether the target call succeeded.
     */
    function receiveMessage(
        Message calldata message,
        bytes   calldata proof
    ) external onlyRelayer returns (bool success) {
        // 1. Replay protection
        bytes32 msgHash = keccak256(abi.encode(message));
        if (processedMessages[msgHash]) revert AlreadyProcessed(msgHash);

        // 2. Signature verification
        if (!_verifyProof(msgHash, proof)) revert InvalidSignature();

        // 3. Target cannot be zero address
        if (message.target == address(0)) revert InvalidTarget();

        // 4. Mark processed before external call (CEI pattern)
        processedMessages[msgHash] = true;

        // 5. Execute
        (success, ) = message.target.call(message.data);

        // 6. Record receipt
        receipts[msgHash] = Receipt({
            executed:  true,
            success:   success,
            timestamp: block.timestamp
        });

        if (success) {
            totalExecuted++;
        } else {
            totalFailed++;
        }

        emit MessageReceived(message.id, message.sender, message.target, success);
    }

    /**
     * @notice Generate the execution proof payload that should be signed by the
     *         hub signing key and submitted as `proof` in `receiveMessage`.
     *         Useful for off-chain relayer tooling.
     */
    function proofPayload(Message calldata message) external pure returns (bytes32) {
        return keccak256(abi.encode(message));
    }

    /**
     * @notice Generate a non-execution (fraud) proof payload.
     *         The hub signing key signs this to indicate a message was NOT executed.
     */
    function nonExecutionProofPayload(
        uint256 messageId,
        uint32  destinationChain
    ) external pure returns (bytes32) {
        return keccak256(abi.encode("NON_EXECUTION", messageId, destinationChain));
    }

    // ── Admin ──────────────────────────────────────────────────────────────────

    function setRelayer(address relayer, bool authorized) external onlyOwner {
        authorizedRelayers[relayer] = authorized;
        emit RelayerAuthorized(relayer, authorized);
    }

    function setHubSigningKey(address newKey) external onlyOwner {
        hubSigningKey = newKey;
        emit HubSigningKeyUpdated(newKey);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ── View ───────────────────────────────────────────────────────────────────

    function isProcessed(Message calldata message) external view returns (bool) {
        return processedMessages[keccak256(abi.encode(message))];
    }

    function getReceipt(Message calldata message)
        external view
        returns (bool executed, bool success, uint256 timestamp)
    {
        Receipt memory r = receipts[keccak256(abi.encode(message))];
        return (r.executed, r.success, r.timestamp);
    }

    // ── Internal ───────────────────────────────────────────────────────────────

    function _verifyProof(bytes32 msgHash, bytes calldata proof)
        internal view
        returns (bool)
    {
        if (proof.length != 65) return false;
        // Prefix the hash as per eth_sign convention
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash)
        );
        address recovered = ECDSA.recover(ethSignedHash, proof);
        return recovered == hubSigningKey;
    }
}
