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

    // ── 16. setMessageHub updates hub ───────────────────────────────────────

    function test_SetMessageHub() public {
        address newHub = address(0xAAAA);
        receiver.setMessageHub(newHub);
        assertEq(receiver.messageHub(), newHub);
    }

    // ── 17. Non-owner cannot setMessageHub ──────────────────────────────────

    function test_SetMessageHub_NonOwnerReverts() public {
        vm.prank(address(0x2222));
        vm.expectRevert(ArbiLinkReceiver.Unauthorized.selector);
        receiver.setMessageHub(address(0xAAAA));
    }

    // ── 18. transferOwnership ────────────────────────────────────────────────

    function test_TransferOwnership_TwoStep() public {
        address newOwner = address(0x3333);
        receiver.transferOwnership(newOwner);
        assertEq(receiver.owner(), address(this));
        assertEq(receiver.pendingOwner(), newOwner);

        // old owner can still administer until acceptance
        receiver.setRelayer(address(0xAAAA), true);
        assertTrue(receiver.authorizedRelayers(address(0xAAAA)));
    }

    // ── 19. acceptOwnership completes two-step transfer ─────────────────────

    function test_AcceptOwnership() public {
        address newOwner = address(0x3333);
        receiver.transferOwnership(newOwner);
        vm.prank(newOwner);
        receiver.acceptOwnership();
        assertEq(receiver.owner(), newOwner);
        assertEq(receiver.pendingOwner(), address(0));

        // new owner can administer
        vm.prank(newOwner);
        receiver.setRelayer(address(0xBBBB), true);
        assertTrue(receiver.authorizedRelayers(address(0xBBBB)));
    }

    // ── 20. Non-pending cannot acceptOwnership ────────────────────────────

    function test_AcceptOwnership_NonPendingReverts() public {
        address newOwner = address(0x3333);
        receiver.transferOwnership(newOwner);
        vm.prank(address(0x9999));
        vm.expectRevert(ArbiLinkReceiver.Unauthorized.selector);
        receiver.acceptOwnership();
    }

    // ── 21. After acceptance, old owner cannot administer ────────────────

    function test_OldOwnerLosesAccessAfterAcceptance() public {
        address newOwner = address(0x3333);
        receiver.transferOwnership(newOwner);
        vm.prank(newOwner);
        receiver.acceptOwnership();

        vm.expectRevert(ArbiLinkReceiver.Unauthorized.selector);
        receiver.setRelayer(address(0xAAAA), true);
    }

    // ── 22. Non-owner cannot transferOwnership ───────────────────────────

    function test_TransferOwnership_NonOwnerReverts() public {
        vm.prank(address(0x9999));
        vm.expectRevert(ArbiLinkReceiver.Unauthorized.selector);
        receiver.transferOwnership(address(0xAAAA));
    }

    // ── 23. nonExecutionProofPayload ─────────────────────────────────────────

    function test_NonExecutionProofPayload() public view {
        bytes32 p = receiver.nonExecutionProofPayload(42, 421614);
        bytes32 expected = keccak256(abi.encode("NON_EXECUTION", uint256(42), uint32(421614)));
        assertEq(p, expected);
    }

    // ── 24. Pause blocks receiveMessage ────────────────────────────────────

    function test_Pause_BlocksReceiveMessage() public {
        receiver.pause();
        ArbiLinkReceiver.Message memory m = _makeMessage(200, address(target), "");
        bytes memory proof = _validProof(m);
        vm.expectRevert(ArbiLinkReceiver.ContractPaused.selector);
        receiver.receiveMessage(m, proof);
    }

    // ── 25. Unpause resumes receiveMessage ─────────────────────────────────

    function test_Unpause_ResumesReceiveMessage() public {
        receiver.pause();
        receiver.unpause();
        ArbiLinkReceiver.Message memory m = _makeMessage(201, address(target), abi.encodeCall(MockTarget.increment, ()));
        bytes memory proof = _validProof(m);
        bool ok = receiver.receiveMessage(m, proof);
        assertTrue(ok);
    }

    // ── 26. Non-owner cannot pause ─────────────────────────────────────────

    function test_Pause_NonOwnerReverts() public {
        vm.prank(address(0x9999));
        vm.expectRevert(ArbiLinkReceiver.Unauthorized.selector);
        receiver.pause();
    }

    // ── 27. Fuzz: proofPayload always matches keccak256(abi.encode(m)) ────────────

    function testFuzz_proofPayload(
        uint256 id,
        address targetAddr,
        bytes calldata data,
        uint32  sourceChain
    ) public view {
        targetAddr = address(uint160(uint256(keccak256(abi.encode(targetAddr)))));
        vm.assume(targetAddr != address(0));
        ArbiLinkReceiver.Message memory m = _makeMessage(id, targetAddr, data);
        // Override sourceChain if different from default 421614
        if (sourceChain != 421614) {
            m.sourceChain = sourceChain;
        }
        bytes32 expected = keccak256(abi.encode(m));
        assertEq(receiver.proofPayload(m), expected);
    }

    // ── 28. Fuzz: wrong-key signatures are rejected ─────────────────────────

    function testFuzz_RandomInvalidProof(uint256 id, uint256 wrongKey) public {
        // Bound to valid Secp256k1 range and avoid colliding with the test signing key
        wrongKey = bound(wrongKey, 1, 0xBEEF - 1);
        ArbiLinkReceiver.Message memory m = _makeMessage(id, address(0xCAFE), "");
        bytes32 msgHash = keccak256(abi.encode(m));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongKey, ethHash);
        bytes memory proof = abi.encodePacked(r, s, v);
        vm.expectRevert(ArbiLinkReceiver.InvalidSignature.selector);
        receiver.receiveMessage(m, proof);
    }

    // ── 29. Fuzz: random malformed proof lengths are rejected ───────────────

    function testFuzz_InvalidProofLength(uint256 id, uint8 length) public {
        length = uint8(bound(uint256(length), 0, 128));
        vm.assume(length != 65);
        bytes memory proof = new bytes(length);
        ArbiLinkReceiver.Message memory m = _makeMessage(id, address(0xCAFE), "");
        vm.expectRevert(ArbiLinkReceiver.InvalidSignature.selector);
        receiver.receiveMessage(m, proof);
    }

    // ── 30. Fuzz: valid random messages all succeed ─────────────────────────

    function testFuzz_ReceiveMessage(
        uint256 id,
        address targetAddr,
        bytes calldata data
    ) public {
        targetAddr = address(uint160(uint256(keccak256(abi.encode(targetAddr)))));
        vm.assume(targetAddr != address(0));
        vm.assume(data.length <= 256); // avoid absurdly long calldata

        ArbiLinkReceiver.Message memory m = _makeMessage(id, targetAddr, data);
        bytes memory proof = _validProof(m);

        receiver.receiveMessage(m, proof);
        // The target address is random — it'll either succeed (EOA) or revert.
        // We just verify no exception is thrown and the message is processed.
        assertTrue(receiver.isProcessed(m));
    }

    // ── 31. Multiple distinct messages are all accepted ──────────────────────

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
