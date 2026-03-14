// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MerkleAnchor
 * @notice Stores Merkle roots for documents so buyers can verify
 *         disclosed content against a tamper-proof on-chain fingerprint.
 *
 *         Only the original host (document owner) can anchor or update
 *         a root. Anyone can read the root for verification.
 */
contract MerkleAnchor {
    struct Anchor {
        bytes32 merkleRoot;
        address host;
        uint256 totalLeaves;
        uint256 anchoredAt;
        bool exists;
    }

    /// docId (string hash) => Anchor
    mapping(bytes32 => Anchor) private anchors;

    /// Track all anchored doc IDs for enumeration
    bytes32[] public anchoredDocs;

    event RootAnchored(
        bytes32 indexed docHash,
        string docId,
        bytes32 merkleRoot,
        address indexed host,
        uint256 totalLeaves
    );

    event RootUpdated(
        bytes32 indexed docHash,
        bytes32 oldRoot,
        bytes32 newRoot,
        address indexed host
    );

    /**
     * @notice Anchor a Merkle root for a document.
     * @param docId       Human-readable document identifier (e.g. Fileverse ddocId)
     * @param merkleRoot  SHA-256 Merkle root of all document lines
     * @param totalLeaves Number of leaves in the padded tree
     */
    function anchorRoot(
        string calldata docId,
        bytes32 merkleRoot,
        uint256 totalLeaves
    ) external {
        require(merkleRoot != bytes32(0), "Root cannot be zero");
        require(totalLeaves > 0, "Must have at least one leaf");

        bytes32 docHash = keccak256(abi.encodePacked(docId));
        Anchor storage a = anchors[docHash];

        if (a.exists) {
            // Only the original host can update
            require(a.host == msg.sender, "Only original host can update root");
            emit RootUpdated(docHash, a.merkleRoot, merkleRoot, msg.sender);
            a.merkleRoot = merkleRoot;
            a.totalLeaves = totalLeaves;
            a.anchoredAt = block.timestamp;
        } else {
            anchors[docHash] = Anchor({
                merkleRoot: merkleRoot,
                host: msg.sender,
                totalLeaves: totalLeaves,
                anchoredAt: block.timestamp,
                exists: true
            });
            anchoredDocs.push(docHash);
            emit RootAnchored(docHash, docId, merkleRoot, msg.sender, totalLeaves);
        }
    }

    /**
     * @notice Get the anchored root for a document.
     * @param docId Document identifier
     * @return merkleRoot  The stored Merkle root
     * @return host        Address of the document owner
     * @return totalLeaves Padded leaf count
     * @return anchoredAt  Timestamp of anchoring
     */
    function getRoot(string calldata docId)
        external
        view
        returns (
            bytes32 merkleRoot,
            address host,
            uint256 totalLeaves,
            uint256 anchoredAt
        )
    {
        bytes32 docHash = keccak256(abi.encodePacked(docId));
        Anchor memory a = anchors[docHash];
        require(a.exists, "Document not anchored");
        return (a.merkleRoot, a.host, a.totalLeaves, a.anchoredAt);
    }

    /**
     * @notice Verify that a given root matches the anchored root.
     * @param docId      Document identifier
     * @param claimedRoot Root to check
     * @return matches   True if the claimed root matches the on-chain anchor
     */
    function verifyRoot(string calldata docId, bytes32 claimedRoot)
        external
        view
        returns (bool matches)
    {
        bytes32 docHash = keccak256(abi.encodePacked(docId));
        Anchor memory a = anchors[docHash];
        require(a.exists, "Document not anchored");
        return a.merkleRoot == claimedRoot;
    }

    /**
     * @notice Get total number of anchored documents.
     */
    function totalAnchored() external view returns (uint256) {
        return anchoredDocs.length;
    }
}
