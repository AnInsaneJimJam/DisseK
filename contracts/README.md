# DisseK — Smart Contracts

Solidity contracts for on-chain anchoring of Merkle roots. Built with Foundry.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `cast`, `anvil`)

## Install

```bash
forge install
```

## Build

```bash
forge build
```

## Test

```bash
forge test
```

## Deploy

```bash
# To a local Anvil node
anvil &
forge script script/MerkleAnchor.s.sol --rpc-url http://127.0.0.1:8545 --broadcast

# To Base Sepolia
forge script script/MerkleAnchor.s.sol \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY \
  --broadcast --verify
```

## Contract

**`MerkleAnchor.sol`** — Stores document Merkle roots on-chain so anyone can independently verify a selective disclosure without trusting the seller.

| Function | Description |
|---|---|
| `anchor(bytes32 root, string ddocId)` | Anchor a Merkle root for a document |
| `getRoot(string ddocId)` | Look up the anchored root for a document |
