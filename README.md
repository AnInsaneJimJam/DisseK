# DisseK — Selective Disclosure of Knowledge

**Prove what you share. Hide what you don't.**

DisseK is a decentralised marketplace where data owners sell cryptographically verified slices of their documents — without ever exposing the rest. Buyers (humans or AI agents) pay via stablecoin micropayments, receive the exact lines they purchased, and get a Merkle range proof that mathematically guarantees authenticity. No trust required.

---

## How It Works

1. **Publisher** uploads a document to Fileverse, builds a Merkle tree over every line, and anchors the root on-chain
2. **Buyer** browses the marketplace, picks a section (or custom line range), and clicks purchase
3. **Host backend** generates a selective disclosure: only the purchased lines + a multi-proof
4. **Buyer verifies** the proof against the on-chain Merkle root — if it matches, the data is authentic

The undisclosed lines never leave the host. The marketplace never sees full document content. Verification is free and permissionless.

---

## Tech Stack

```
proof-engine/     Rust → WASM    Merkle tree + range proofs (rs_merkle, sha2)
backend/          Express.js     Host server — Fileverse integration, proof generation
marketplace/      Express.js     Public directory — listings, purchase relay, Firestore/in-memory store
frontend/         React + Vite   SPA — wallet connect (MetaMask + SIWE), purchase, verify
contracts/        Solidity       MerkleAnchor.sol — on-chain root registry (Foundry)
```

---

## Fileverse Integration

DisseK uses [Fileverse](https://fileverse.io) as its decentralised document storage layer, accessed via the **Model Context Protocol (MCP)**.

- Documents live as Fileverse **dDocs** — decentralised, blockchain-synced, and content-addressed
- The host backend connects to Fileverse's MCP server using `@modelcontextprotocol/sdk` with `StreamableHTTPClientTransport`
- When a publisher lists a document, DisseK reads it from Fileverse, builds the Merkle tree, and stores only the root hash on-chain
- When a buyer purchases a section, a **new** partial dDoc is created on Fileverse containing only the disclosed lines (no proof data, just clean content)
- The buyer gets a Fileverse link to the disclosure document plus the proof package separately

The marketplace itself never touches document content — it only stores metadata, section definitions, and Merkle roots. All content flows through Fileverse, keeping the system truly decentralised.

---

## ENS Integration

ENS is the identity layer that powers access control for both individuals and organizations.

### For Individuals
When a wallet connects, we do **bidirectional ENS resolution** — reverse lookup (`0xABC → alice.eth`) followed by forward verification (`alice.eth → 0xABC`). Only if both match is the identity considered verified. This prevents anyone from spoofing someone else's name.

### For Organizations & AI Agents
This is where it gets interesting. An organization like Google owns `google.eth`. Each of their AI agents gets a subname — `agent-42.google.eth`. When the organization purchases a dataset section, they buy a **namespace grant** for `google.eth`. Now any agent under `*.google.eth` automatically gets access.

### ENSIP-25 — Trustless Agent Verification
To prevent rogue subnames, we implement **ENSIP-25**. The parent domain owner must set an ENS text record (with an **ERC-7930** encoded registry address) attesting that the agent is registered in an **ERC-8004** on-chain identity registry. Our system reads that text record directly from the ENS resolver — one lookup, fully trustless, no middleman.

This makes ENS the identity primitive for agent-to-agent data commerce.

---

## Challenges & Learnings

**Rust WASM compilation has target-specific quirks.** The proof engine must be compiled with `--target nodejs` for the backend. The leaf array also needs padding to the next power-of-two — a requirement of `rs_merkle` that isn't obvious from the docs.

**Fileverse document creation is async.** When generating a disclosure, the new partial dDoc syncs to the blockchain asynchronously. We had to treat the Fileverse link as best-effort and return the proof package immediately.

**ENSIP-25 involves two independent chain IDs.** The ERC-8004 registry can be on Base Sepolia while the ENS text records live on Ethereum mainnet. Getting the ERC-7930 encoding right across chains required careful byte-level packing.

**Browser polyfills for crypto libraries.** The `siwe` package depends on Node.js `Buffer` which doesn't exist in browsers. Required a global polyfill in `main.tsx` before any other imports.

---

## Setup

### Prerequisites
https://youtu.be/30YRtetrvGY

- **Rust + wasm-pack** — for compiling the proof engine
- **Node.js ≥ 20** — for all three servers
- **MetaMask** — for wallet connection
### Quick Start

```bash
# 1. Build the WASM proof engine
cd proof-engine && wasm-pack build --target nodejs --out-dir pkg && cd ..

# 2. Install dependencies
cd backend && npm install && cd ..
cd marketplace && npm install && cd ..
cd frontend && npm install && cd ..

# 3. Configure environment
cp backend/.env.example backend/.env
cp marketplace/.env.example marketplace/.env

# 4. Start all servers
bash restart.sh

# Or manually:
# cd backend && npm run dev &
# cd marketplace && npm run dev &
# cd frontend && npm run dev &
```

### Verify

```bash
curl http://localhost:3001/health        # Host backend
curl http://localhost:3002/api/health    # Marketplace
# Frontend at http://localhost:5173
```

See individual directory READMEs for more details:
- [`backend/README.md`](backend/README.md)
- [`marketplace/README.md`](marketplace/README.md)
- [`frontend/README.md`](frontend/README.md)
- [`proof-engine/README.md`](proof-engine/README.md)
- [`contracts/README.md`](contracts/README.md)

---

## Future Goals

- **Agent-native SDK** — a standalone TypeScript/Python client that lets AI agents discover, purchase, and verify data without a browser
- **Multi-chain support** — deploy MerkleAnchor on multiple L2s, support cross-chain proof verification
- **Reputation oracle** — move the host reputation system on-chain, let verified purchases and successful verifications increase reputation automatically
- **Encrypted disclosures** — encrypt disclosed lines with the buyer's public key so only they can read the content, even if the response is intercepted
- **ENSIP-25 delegation UI** — a frontend for organizations to register agents and set text records without touching a CLI
- **Fileverse IPFS pinning** — pin disclosure documents to IPFS for long-term availability beyond Fileverse's sync window

---

## License

MIT
