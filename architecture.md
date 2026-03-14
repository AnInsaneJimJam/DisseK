# Selective Disclosure via Merkle Range Proofs

## 1. Project Overview
This project implements a "Partial View" system using Fileverse. It allows a user (Owner) to upload a document, and then selectively share a specific range of lines with another user (Bob) using Merkle Range Proofs.

## 2. Cryptographic Specification
### Leaf Construction
To prevent Second Pre-image Attacks and rearrangement:
`Leaf_i = Hash(0x00 || Index_i || Line_i || Salt_i)`
- `0x00`: Domain separation byte for leaves.
- `Index_i`: 32-bit integer representing the line number computationally.
- `Line_i`: The actual content of the line.
- `Salt_i`: 32-byte cryptographically secure random string.

### Node Construction
`Node = Hash(0x01 || LeftChild || RightChild)`
- `0x01`: Domain separation byte for internal nodes.

### Tree Structure
- **Dense Balanced Merkle Tree**: Padded to the nearest power of 2 using dummy hashes (`Hash(0x00 || "PAD" || Salt)`).

## 3. Architecture & Tech Stack
- **Languages**: Rust (for cryptography/WASM), TypeScript (for integration/orchestration).
- **Orchestration**: `@fileverse/agents` (v2.0.1+)
- **Cryptography**: `@fileverse/crypto` (ECIES, symmetric crypto)
- **Proof Engine**: Rust compiled to WASM (`rs_merkle` or custom implementation).
- **Storage**: IPFS via Fileverse Pinning.

## 4. Workflows

### Phase 1: Upload (Alice)
1. Split document into lines.
2. Generate secure 32-byte salt for each line.
3. Pad to nearest power of 2.
4. Hash leaves and build Merkle Tree to get `MerkleRoot`.
5. Derive a symmetric key from Alice's private key.
6. Encrypt the raw file and salt map with the symmetric key.
7. Upload encrypted blob via `agent.create()` to IPFS.
8. Store `MerkleRoot` in Fileverse metadata.

### Phase 2: Selective Sharing (Alice -> Bob)
1. Alice selects range (e.g., lines 1-80).
2. Extract lines 1-80 and salts 1-80.
3. Compute Range Proof (Multi-proof hashes needed to reach the root).
4. Create Proof Package JSON.
5. Encrypt Proof Package with Bob's ECIES public key.
6. Share as a sidecar file or P2P message.

### Phase 3: Verification (Bob)
1. Fetch `MerkleRoot` from metadata via `agent.getFile()`.
2. Decrypt Proof Package using Bob's ECIES private key.
3. Re-hash lines 1-80 with salts 1-80 (including `Index`).
4. Apply Multi-proof using the WASM engine.
5. If `CalculatedRoot == AuthoritativeRoot`, verification passes.
