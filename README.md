# DisseK — Selective Disclosure of Knowledge

**Prove what you share. Hide what you don't.**

DisseK is a decentralised marketplace where data owners sell cryptographically verified slices of their documents — without ever exposing the rest. Buyers (humans or AI agents) pay via stablecoin micropayments, receive the exact lines they purchased, and get a Merkle range proof that mathematically guarantees authenticity. No trust required.

---

## How It Works

1. **Publisher** uploads a document to Fileverse, builds a Merkle tree over every line, and anchors the root on-chain
2. **Buyer** browses the marketplace, picks a section (or custom line range), and clicks purchase
3. **x402** handles payment automatically — USDC on Base, settled in one HTTP round-trip
4. **Host backend** generates a selective disclosure: only the purchased lines + a multi-proof
5. **Buyer verifies** the proof against the on-chain Merkle root — if it matches, the data is authentic

The undisclosed lines never leave the host. The marketplace never sees full document content. Verification is free and permissionless.

---

## Tech Stack

```
proof-engine/     Rust → WASM    Merkle tree + range proofs (rs_merkle, sha2)
backend/          Express.js     Host server — Fileverse integration, proof generation, x402 paywall
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

## Elsa x402 Integration

[x402](https://x402.org) is an HTTP-native payment protocol that uses the `402 Payment Required` status code for machine-to-machine stablecoin micropayments.

### How It Works in DisseK

Two endpoints are paywalled across two servers:

| Endpoint | Server | Price |
|---|---|---|
| `POST /disclose` | Host Backend (:3001) | $0.01 USDC |
| `POST /api/documents/:id/purchase` | Marketplace (:3002) | $0.01 USDC |

The flow is fully automatic:

1. Client sends a request to a paywalled endpoint
2. Server responds with **HTTP 402** + a `PAYMENT-REQUIRED` header
3. The buyer's x402 client (in the browser) reads the requirements, prompts MetaMask for a USDC authorization signature
4. Payment is settled on-chain via the x402 Facilitator
5. Client retries the request with the settlement receipt
6. Server validates and serves the response

No accounts, no invoices, no manual transfers. An AI agent can autonomously discover data, pay for it, receive it, and verify it — all in one HTTP conversation.

**Packages:** `@x402/express`, `@x402/evm`, `@x402/core` (server-side) · `@x402/fetch`, `@x402/evm` (client-side)
**Network:** Base Sepolia (testnet) · Base Mainnet (production)
**Asset:** USDC

---

## Challenges & Learnings

**x402 doesn't support parameterised Express routes.** The middleware does exact string matching, so `POST /api/documents/:id/purchase` never matched. We solved this by mounting an Express sub-Router at the parameterised path, so x402 sees `POST /` and matches correctly.

**Rust WASM compilation has target-specific quirks.** The proof engine must be compiled with `--target nodejs` for the backend. The leaf array also needs padding to the next power-of-two — a requirement of `rs_merkle` that isn't obvious from the docs.

**Fileverse document creation is async.** When generating a disclosure, the new partial dDoc syncs to the blockchain asynchronously. We had to treat the Fileverse link as best-effort and return the proof package immediately.

**ENSIP-25 involves two independent chain IDs.** The ERC-8004 registry can be on Base Sepolia while the ENS text records live on Ethereum mainnet. Getting the ERC-7930 encoding right across chains required careful byte-level packing.

**Browser polyfills for crypto libraries.** The `siwe` package depends on Node.js `Buffer` which doesn't exist in browsers. Required a global polyfill in `main.tsx` before any other imports.

---

## Setup

### Prerequisites

- **Rust + wasm-pack** — for compiling the proof engine
- **Node.js ≥ 20** — for all three servers
- **MetaMask** — for wallet connection and x402 payments
- **USDC on Base Sepolia** — for testing payments ([faucet](https://faucet.circle.com/))

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
# Edit both .env files — set EVM_PAY_TO_ADDRESS to your wallet

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

### Test x402 Paywalls

```bash
# Both should return HTTP 402
curl -s -w "%{http_code}" -X POST http://localhost:3001/disclose \
  -H "Content-Type: application/json" \
  -d '{"ddocId":"test","startLine":0,"endLine":1}'

curl -s -w "%{http_code}" -X POST http://localhost:3002/api/documents/test/purchase \
  -H "Content-Type: application/json" \
  -d '{"sectionId":"s1","buyerAddress":"0x123"}'
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
- **Streaming disclosures** — reveal lines incrementally as payment streams in, using x402's streaming payment mode
- **Reputation oracle** — move the host reputation system on-chain, let verified purchases and successful verifications increase reputation automatically
- **Encrypted disclosures** — encrypt disclosed lines with the buyer's public key so only they can read the content, even if the response is intercepted
- **Batch purchases** — purchase multiple sections across multiple documents in a single x402 transaction
- **ENSIP-25 delegation UI** — a frontend for organizations to register agents and set text records without touching a CLI
- **Fileverse IPFS pinning** — pin disclosure documents to IPFS for long-term availability beyond Fileverse's sync window

---

## License

MIT
