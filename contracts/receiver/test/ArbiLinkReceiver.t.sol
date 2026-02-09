// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ArbiLinkReceiver.sol";
import "../src/ECDSA.sol";

/// @title  Minimal call target used in several tests
contract MockTarget {
    uint256 public callCount;
    bytes   public lastCalldata;
    bool    public shouldRevert;

    function increment() external {
        if (shouldRevert) revert("MockTarget: forced revert");
        callCount++;
        lastCalldata = msg.data;
    }

    function setShouldRevert(bool v) external { shouldRevert = v; }
}

/// @title  ArbiLinkReceiver Foundry test suite (18 tests)
contract ArbiLinkReceiverTest is Test {
    ArbiLinkReceiver receiver;
    MockTarget       target;

    address constant HUB   = address(0xAB);
    uint256 signerPrivKey  = 0xBEEF;
    address signerAddr;
    address relayer        = address(this); // test contract is relayer

    // ── Helpers ──────────────────────────────────────────────────────────────

    function _makeMessage(uint256 id, address tgt, bytes memory data)
        internal pure
        returns (ArbiLinkReceiver.Message memory)
    {
        return ArbiLinkReceiver.Message({
            id:          id,
            sender:      address(0x1234),
            target:      tgt,
            data:        data,
            sourceChain: 421614
        });
    }

    function _sign(bytes32 msgHash) internal view returns (bytes memory) {
        bytes32 ethHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivKey, ethHash);
        return abi.encodePacked(r, s, v);
    }

    function _validProof(ArbiLinkReceiver.Message memory m)
        internal view
        returns (bytes memory)
    {
        bytes32 msgHash = keccak256(abi.encode(m));
        return _sign(msgHash);
    }

    // ── Setup ─────────────────────────────────────────────────────────────────

    function setUp() public {
        signerAddr = vm.addr(signerPrivKey);
        receiver   = new ArbiLinkReceiver(HUB, signerAddr);
        target     = new MockTarget();
    }

    // ── 1. Deployment state ───────────────────────────────────────────────────

    function test_DeploymentState() public view {
        assertEq(receiver.messageHub(),    HUB,        "messageHub mismatch");
        assertEq(receiver.hubSigningKey(), signerAddr, "signingKey mismatch");
        assertEq(receiver.owner(),         address(this), "owner mismatch");
        assertTrue(receiver.authorizedRelayers(address(this)), "deployer should be relayer");
        assertEq(receiver.totalExecuted(), 0);
        assertEq(receiver.totalFailed(),   0);
    }

    // ── 2. Successful message delivery ───────────────────────────────────────

    function test_ReceiveMessage_Success() public {
        ArbiLinkReceiver.Message memory m = _makeMessage(
            1,
            address(target),
            abi.encodeCall(MockTarget.increment, ())
        );
        bytes memory proof = _validProof(m);

        bool ok = receiver.receiveMessage(m, proof);

        assertTrue(ok,                        "should return true");
        assertEq(target.callCount(), 1,       "target should be called once");
        assertEq(receiver.totalExecuted(), 1, "totalExecuted should be 1");
        assertEq(receiver.totalFailed(),   0);
    }

    // ── 3. Replay protection ──────────────────────────────────────────────────

    function test_ReplayReverts() public {
        ArbiLinkReceiver.Message memory m = _makeMessage(
            2, address(target), abi.encodeCall(MockTarget.increment, ())
        );
        bytes memory proof = _validProof(m);

        receiver.receiveMessage(m, proof);

        bytes32 hash = keccak256(abi.encode(m));
        vm.expectRevert(abi.encodeWithSelector(ArbiLinkReceiver.AlreadyProcessed.selector, hash));
        receiver.receiveMessage(m, proof);
    }

    // ── 4. Invalid signature reverts ──────────────────────────────────────────

    function test_InvalidSignatureReverts() public {
        ArbiLinkReceiver.Message memory m = _makeMessage(
            3, address(target), abi.encodeCall(MockTarget.increment, ())
        );
        // Sign with wrong key
        uint256 wrongKey = 0xDEAD;
        bytes32 h = keccak256(abi.encode(m));
        bytes32 eth = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", h));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongKey, eth);
        bytes memory wrongProof = abi.encodePacked(r, s, v);

        vm.expectRevert(ArbiLinkReceiver.InvalidSignature.selector);
        receiver.receiveMessage(m, wrongProof);
    }

    // ── 5. Non-relayer reverts ────────────────────────────────────────────────

    function test_NonRelayerReverts() public {
        ArbiLinkReceiver.Message memory m = _makeMessage(
            4, address(target), abi.encodeCall(MockTarget.increment, ())
        );
        bytes memory proof = _validProof(m);

        address stranger = address(0xBEBE);
        vm.prank(stranger);
        vm.expectRevert(ArbiLinkReceiver.NotRelayer.selector);
        receiver.receiveMessage(m, proof);
    }

    // ── 6. Zero-address target reverts ────────────────────────────────────────

    function test_ZeroTargetReverts() public {
        ArbiLinkReceiver.Message memory m = _makeMessage(
            5, address(0), abi.encodeCall(MockTarget.increment, ())
        );
        bytes memory proof = _validProof(m);

        vm.expectRevert(ArbiLinkReceiver.InvalidTarget.selector);
        receiver.receiveMessage(m, proof);
    }

    // ── 7. Target reverts – message still stored as failed ────────────────────

    function test_TargetRevert_StoredAsFailed() public {
        target.setShouldRevert(true);
        ArbiLinkReceiver.Message memory m = _makeMessage(
            6, address(target), abi.encodeCall(MockTarget.increment, ())
        );
        bytes memory proof = _validProof(m);

        bool ok = receiver.receiveMessage(m, proof);

        assertFalse(ok,                      "should return false on target revert");
        assertEq(receiver.totalFailed(), 1,  "totalFailed should be 1");
        assertEq(receiver.totalExecuted(), 0);

        // Message is marked processed (can't replay even on failure)
        bytes32 hash = keccak256(abi.encode(m));
        assertTrue(receiver.processedMessages(hash));
    }

    // ── 8. Receipt is stored correctly ───────────────────────────────────────

    function test_ReceiptStoredOnSuccess() public {
        ArbiLinkReceiver.Message memory m = _makeMessage(
            7, address(target), abi.encodeCall(MockTarget.increment, ())
        );
        bytes memory proof = _validProof(m);

        vm.warp(1_000_000);
        receiver.receiveMessage(m, proof);

        (bool executed, bool success, uint256 ts) = receiver.getReceipt(m);
        assertTrue(executed);
        assertTrue(success);
        assertEq(ts, 1_000_000);
    }

    // ── 9. isProcessed() view ─────────────────────────────────────────────────

    function test_IsProcessed() public {
        ArbiLinkReceiver.Message memory m = _makeMessage(
            8, address(target), abi.encodeCall(MockTarget.increment, ())
        );
        bytes memory proof = _validProof(m);

        assertFalse(receiver.isProcessed(m), "should be false before execution");
        receiver.receiveMessage(m, proof);
        assertTrue(receiver.isProcessed(m),  "should be true after execution");
    }

    // ── 10. proofPayload matches expectation ─────────────────────────────────

    function test_ProofPayload() public view {
        ArbiLinkReceiver.Message memory m = _makeMessage(
            9, address(target), "0x"
        );
        bytes32 expected = keccak256(abi.encode(m));
        assertEq(receiver.proofPayload(m), expected);
    }

    // ── 11. setRelayer adds a new relayer ─────────────────────────────────────

    function test_SetRelayer_Adds() public {
        address newRelayer = address(0xCAFE);
        assertFalse(receiver.authorizedRelayers(newRelayer));

        receiver.setRelayer(newRelayer, true);
        assertTrue(receiver.authorizedRelayers(newRelayer));
    }

    // ── 12. setRelayer removes a relayer ──────────────────────────────────────

    function test_SetRelayer_Removes() public {
        address newRelayer = address(0xCAFE);
        receiver.setRelayer(newRelayer, true);
        receiver.setRelayer(newRelayer, false);
        assertFalse(receiver.authorizedRelayers(newRelayer));
    }

    // ── 13. Non-owner cannot setRelayer ──────────────────────────────────────

    function test_SetRelayer_NonOwnerReverts() public {
        vm.prank(address(0x1111));
        vm.expectRevert(ArbiLinkReceiver.Unauthorized.selector);
        receiver.setRelayer(address(0xCAFE), true);
    }

    // ── 14. setHubSigningKey updates key ─────────────────────────────────────

    function test_SetHubSigningKey() public {
        address newKey = address(0x9999);
        receiver.setHubSigningKey(newKey);
        assertEq(receiver.hubSigningKey(), newKey);
    }

    // ── 15. Non-owner cannot setHubSigningKey ────────────────────────────────

    function test_SetHubSigningKey_NonOwnerReverts() public {
        vm.prank(address(0x2222));
        vm.expectRevert(ArbiLinkReceiver.Unauthorized.selector);
        receiver.setHubSigningKey(address(0x9999));
    }

    // ── 16. transferOwnership ────────────────────────────────────────────────

    function test_TransferOwnership() public {
        address newOwner = address(0x3333);
        receiver.transferOwnership(newOwner);
        assertEq(receiver.owner(), newOwner);

        // old owner can no longer administer
        vm.expectRevert(ArbiLinkReceiver.Unauthorized.selector);
        receiver.setRelayer(address(0xAAAA), true);
    }

    // ── 17. nonExecutionProofPayload ─────────────────────────────────────────

    function test_NonExecutionProofPayload() public view {
        bytes32 p = receiver.nonExecutionProofPayload(42, 421614);
        bytes32 expected = keccak256(abi.encode("NON_EXECUTION", uint256(42), uint32(421614)));
        assertEq(p, expected);
    }

    // ── 18. Multiple distinct messages are all accepted ──────────────────────

    function test_MultipleDistinctMessages() public {
        for (uint256 i = 1; i <= 5; i++) {
            ArbiLinkReceiver.Message memory m = _makeMessage(
                i * 100,
                address(target),
                abi.encodeCall(MockTarget.increment, ())
            );
            bytes memory proof = _validProof(m);
            bool ok = receiver.receiveMessage(m, proof);
            assertTrue(ok);
        }
        assertEq(target.callCount(),       5);
        assertEq(receiver.totalExecuted(), 5);
    }
}
