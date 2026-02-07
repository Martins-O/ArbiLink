// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ECDSA
 * @notice Minimal ECDSA signature recovery (subset of OZ's ECDSA library).
 */
library ECDSA {
    error InvalidSignatureLength();
    error InvalidSignatureS();

    /**
     * @dev Recover signer from a 65-byte (r, s, v) signature over `hash`.
     */
    function recover(bytes32 hash, bytes calldata signature)
        internal pure
        returns (address)
    {
        if (signature.length != 65) revert InvalidSignatureLength();

        bytes32 r;
        bytes32 s;
        uint8   v;

        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }

        // EIP-2 malleable signature prevention
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            revert InvalidSignatureS();
        }

        // Normalise v
        if (v < 27) v += 27;

        address signer = ecrecover(hash, v, r, s);
        require(signer != address(0), "ECDSA: zero address");
        return signer;
    }

    /**
     * @dev Returns the eth_sign prefixed message hash.
     */
    function toEthSignedMessageHash(bytes32 hash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }
}
