# Selective Disclosure Architecture

This architecture outlines a simplified approach to enable selective disclosure of a Fileverse document using Merkle Range Proofs. It allows an Owner to share a specific portion of a document with another user (Bob), while mathematically proving its authenticity against the original document's root.

## 1. Fetching the Original Document
- The **Owner** fetches their original encrypted document from the Fileverse API.
- The document is decrypted and loaded into memory as an array of sequential lines.

## 2. Running the Proof (Tree Generation)
- The **Owner** passes the document into the Rust-based `DocumentTree` WASM engine.
- The engine hashes each line (combining the line index and a salt to prevent tampering).
- A **Merkle Tree** is generated, outputting an authoritative `MerkleRoot` that uniquely represents the entire document.

## 3. Disclosing the Selected Part
- The **Owner** selects a specific range of lines they want to share with Bob (e.g., lines 1 to 5).
- The `DocumentTree` engine extracts:
  1. The selected contiguous lines.
  2. The corresponding salts for those lines.
  3. A **Multi-Proof** (the minimal set of cryptographic hashes needed to bridge the gap between those specific lines and the master `MerkleRoot`).
- The **Owner** creates a new partial document (`tested_doc.txt`) containing *only* the disclosed lines, and bundles it alongside the Multi-Proof package.

## 4. Verification (Bob's end)
- **Bob** receives the new partial document (`tested_doc.txt`) and the Multi-Proof package.
- **Bob** independently fetches the authoritative `MerkleRoot` directly from the Fileverse metadata/API to ensure trust.
- **Bob** inputs the disclosed lines, the salts, and the Multi-Proof into his own local `DocumentTree` verifier.
- The local WASM engine mathematically confirms whether the partial document reconstructs to the exact same authoritative `MerkleRoot`. 
- **Result:** Bob has absolute cryptographic certainty that the shared lines perfectly match the original document on Fileverse, without ever seeing the remaining undisclosed content.
