# DisseK — Proof Engine

Rust WASM library for Merkle tree operations: building trees, generating range proofs, and verifying selective disclosures.

## Prerequisites

- [Rust](https://rustup.rs/) (stable toolchain)
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)

```bash
# Install wasm-pack if you don't have it
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```

## Build

```bash
wasm-pack build --target nodejs --out-dir pkg
```

This compiles the Rust library to WASM and generates a `pkg/` directory with the Node.js bindings. The `backend/` package depends on this via `"proof-engine": "file:../proof-engine/pkg"`.

## Test

```bash
cargo test
```

## Key Exports

| Function | Description |
|---|---|
| `build_merkle_tree(lines, salts)` | Build a Merkle tree from document lines, returns root hash |
| `generate_range_proof(lines, salts, start, end)` | Generate a multi-proof for a line range |
| `verify_range_proof(disclosed, proof_package)` | Verify disclosed lines against a proof package |

## Dependencies

| Crate | Purpose |
|---|---|
| `rs_merkle` | Merkle tree construction and proof generation |
| `sha2` | SHA-256 hashing for leaf nodes |
| `wasm-bindgen` | Rust ↔ JavaScript FFI |
| `hex` | Hex encoding for hashes and proofs |
