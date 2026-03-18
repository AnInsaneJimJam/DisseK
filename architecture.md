# DisseK — Complete System Architecture

DisseK (Selective Disclosure of Knowledge) is a decentralised protocol for monetising and verifying partial document content. Document owners list their files on a marketplace, define purchasable sections, and sell cryptographically-proven excerpts to buyers — all without revealing the undisclosed parts.

---

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [Repository Layout](#2-repository-layout)
3. [Component Deep-Dive](#3-component-deep-dive)
   - 3.1 [Proof Engine (Rust → WASM)](#31-proof-engine-rust--wasm)
   - 3.2 [Host Backend (Express.js)](#32-host-backend-expressjs)
   - 3.3 [Marketplace Backend (Express.js)](#33-marketplace-backend-expressjs)
   - 3.4 [Frontend (React + Vite)](#34-frontend-react--vite)
   - 3.5 [Smart Contracts (Solidity)](#35-smart-contracts-solidity)
4. [Data Flow: Publish](#4-data-flow-publish)
5. [Data Flow: Purchase & Disclosure](#5-data-flow-purchase--disclosure)
6. [Data Flow: Verification](#6-data-flow-verification)
7. [Fileverse MCP Integration](#7-fileverse-mcp-integration)
8. [Merkle Range Proof Scheme](#8-merkle-range-proof-scheme)
9. [Trust Model](#9-trust-model)
10. [Environment Configuration](#10-environment-configuration)
11. [Running the System](#11-running-the-system)

---

## 1. High-Level Overview

```
┌──────────────┐         ┌───────────────────┐         ┌──────────────────┐
│   Frontend   │◄───────►│   Marketplace     │◄───────►│  Host Backend    │
│  (React/Vite)│  HTTP   │   (Express :3002) │  HTTP   │  (Express :3001) │
│  port 5173   │         │                   │         │                  │
└──────┬───────┘         └────────┬──────────┘         └────────┬─────────┘
       │                          │                             │
       │ Vite proxy               │ Firestore/in-memory         │ MCP (StreamableHTTP)
       │ /api → :3002             │ store for listings          │
       │ /host-api → :3001        │                             ▼
       │                          │                    ┌──────────────────┐
       │                          │                    │  Fileverse dDocs │
       │                          │                    │  (MCP Server)    │
       │                          │                    └──────────────────┘
       │                          │
       ▼                          ▼
┌──────────────┐         ┌───────────────────┐
│  MetaMask    │         │  MerkleAnchor.sol │
│  (ethers.js) │         │  (Base Sepolia)   │
│  SIWE auth   │         │  on-chain roots   │
└──────────────┘         └───────────────────┘
```

**Three servers** run concurrently:

| Service            | Port   | Role                                                   |
|--------------------|--------|--------------------------------------------------------|
| **Host Backend**   | `3001` | Holds Fileverse credentials; generates proofs; serves disclosures |
| **Marketplace**    | `3002` | Public index of document listings; relays purchase requests to hosts |
| **Frontend**       | `5173` | React SPA for browsing, purchasing, publishing, and verifying |

---

## 2. Repository Layout

```
DisseK/
├── proof-engine/          # Rust WASM library — Merkle tree + range proofs
│   ├── src/lib.rs         # DocumentTree, MerkleProofEngine (wasm-bindgen)
│   ├── Cargo.toml         # rs_merkle, sha2, wasm-bindgen, js-sys
│   └── pkg/               # wasm-pack build output (consumed by backend)
│
├── backend/               # Host Backend — document owner's private server
│   ├── src/
│   │   ├── server.ts      # Express app, route handlers
│   │   ├── proof-service.ts   # TypeScript wrapper around WASM DocumentTree
│   │   └── fileverse-client.ts # MCP SDK client for Fileverse dDocs
│   ├── .env               # FILEVERSE_API_URL, PORT
│   └── package.json       # proof-engine, MCP SDK, express, cors
│
├── marketplace/           # Marketplace Backend — public discovery + purchase relay
│   ├── src/
│   │   ├── server.ts      # Express app, purchase relay, host forwarding
│   │   ├── store.ts       # Firestore + in-memory fallback data store
│   │   ├── types.ts       # Host, DocumentListing, SectionListing, Purchase
│   │   └── firebase.ts    # Firebase Admin SDK initialisation
│   ├── .env               # MARKETPLACE_PORT
│   └── package.json       # express, cors, firebase-admin, uuid
│
├── frontend/              # React SPA — Vite + TypeScript
│   ├── src/
│   │   ├── App.tsx        # Router: Landing, Marketplace, DocumentDetail, Publish, Verify
│   │   ├── main.tsx       # WalletProvider wrapper
│   │   ├── context/WalletContext.tsx  # MetaMask + SIWE authentication
│   │   ├── api/marketplace.ts        # Typed fetch() wrappers for both backends
│   │   ├── pages/
│   │   │   ├── Landing.tsx            # Hero + feature showcase
│   │   │   ├── Marketplace.tsx        # Browse & search document listings
│   │   │   ├── DocumentDetail.tsx     # View sections, purchase, see proofs
│   │   │   ├── Publish.tsx            # Multi-step wizard: host → doc → sections → list
│   │   │   └── Verify.tsx             # Paste disclosed lines + proof → verify
│   │   └── components/               # Navbar, Footer, DocumentCard
│   └── vite.config.ts    # Proxy: /api → :3002, /host-api → :3001
│
├── contracts/
│   └── MerkleAnchor.sol   # On-chain Merkle root registry
│
├── restart.sh             # Kill + restart all three servers
└── architecture.md        # This file
```

---

## 3. Component Deep-Dive

### 3.1 Proof Engine (Rust → WASM)

**Location:** `proof-engine/`
**Language:** Rust, compiled to WebAssembly via `wasm-pack`
**Crate Dependencies:** `rs_merkle 1.4`, `sha2 0.10`, `wasm-bindgen 0.2`, `js-sys 0.3`

The proof engine is the cryptographic core of DisseK. It provides two WASM-exported structs:

#### `MerkleProofEngine`
Low-level primitives:
- `build_leaf(index, line, salt)` → SHA-256 hash with domain-separated prefix (`0x00` for leaves)
- `build_tree(leaf_hashes)` → builds tree, pads to next power-of-2, returns root
- `get_multi_proof(indices)` → serialised rs_merkle proof bytes
- `verify_multi_proof(root, indices, leaves, proof_bytes, total_leaves)` → bool

#### `DocumentTree`
High-level document abstraction:
- `new(lines: Vec<String>)` → hashes all lines with per-line salts, builds the full tree
- `get_root()` → the authoritative Merkle root (32 bytes)
- `get_total_leaves()` → padded leaf count (next power-of-2)
- `get_salt(index)` → deterministic 32-byte salt for a line
- `extract_range_proof(start, end)` → multi-proof bytes for a contiguous range
- `verify_range(root, start, lines, salts, proof, total)` → static verification

**Hashing scheme:**
```
Leaf:     SHA-256(0x00 || big-endian(index) || line_bytes || salt)
Internal: SHA-256(0x01 || left_child || right_child)
Padding:  SHA-256(0x00 || "PAD" || 0x00×32)
```

**Build command:**
```bash
cd proof-engine && wasm-pack build --target nodejs --out-dir pkg
```

---

### 3.2 Host Backend (Express.js)

**Location:** `backend/`
**Port:** 3001 (configurable via `PORT` env var)

The host backend is the document owner's private server. It:
1. Connects to Fileverse via MCP to read/create documents
2. Wraps the WASM proof engine to generate and verify Merkle proofs
2. Wraps the WASM proof engine to generate and verify Merkle proofs

#### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/disclose` | Free | Generate selective disclosure for a line range |
| `POST` | `/disclose-direct` | Free | Disclosure from raw content (no Fileverse) |
| `POST` | `/verify` | Free | Verify disclosed lines against a proof package |
| `POST` | `/build-tree` | Free | Build Merkle tree, return root hash (for publish flow) |
| `GET`  | `/documents` | Free | List Fileverse documents via MCP |
| `GET`  | `/documents/:ddocId` | Free | Get single document with content + line count |
| `GET`  | `/health` | Free | Health check |

#### Key files:
- **`server.ts`** — Express app, route handlers
- **`proof-service.ts`** — TypeScript wrapper: `generateDisclosure()`, `verifyDisclosure()`, `buildTree()`
- **`fileverse-client.ts`** — Singleton MCP client using `@modelcontextprotocol/sdk` with `StreamableHTTPClientTransport`

---

### 3.3 Marketplace Backend (Express.js)

**Location:** `marketplace/`
**Port:** 3002 (configurable via `MARKETPLACE_PORT` env var)

The marketplace is a public directory. It **never** sees original document content — only metadata, section definitions, and on-chain Merkle roots.

#### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/hosts` | Free | Register a host backend |
| `GET`  | `/api/hosts` | Free | List all registered hosts |
| `GET`  | `/api/hosts/:id` | Free | Get host details |
| `POST` | `/api/documents` | Free | Create a document listing |
| `GET`  | `/api/documents` | Free | Browse/search listings (`?q=...&tag=...`) |
| `GET`  | `/api/documents/:id` | Free | Get listing details + host info |
| `POST` | `/api/documents/:id/purchase` | Free | Purchase a section or line range |
| `GET`  | `/api/purchases/:id` | Free | Get purchase record |
| `GET`  | `/api/purchases?buyer=0x...` | Free | List purchases by buyer |
| `POST` | `/api/verify` | Free | Proxy verification to a host |
| `GET`  | `/api/health` | Free | Health check + stats |

#### Purchase Flow (inside marketplace)
1. Validate the request (section-based or line-by-line)
2. Calculate total cost
3. Create a `Purchase` record (status: `pending`)
4. Forward the disclosure request to the host's `POST /disclose`
5. Store the returned `disclosedLines` + `proofPackage`
6. Return everything to the buyer

#### Data Store
- **Primary:** Firestore (via `firebase-admin`) — persistent across restarts
- **Fallback:** In-memory `Map` — used when no `serviceAccountKey.json` is present
- Dual-write: data is always kept in memory and optionally persisted to Firestore

---

### 3.4 Frontend (React + Vite)

**Location:** `frontend/`
**Port:** 5173

A single-page application with five routes:

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `Landing` | Hero page, feature showcase |
| `/marketplace` | `Marketplace` | Search & browse document listings |
| `/document/:id` | `DocumentDetail` | View sections, purchase, see disclosed lines + proof |
| `/publish` | `Publish` | Multi-step wizard for listing documents |
| `/verify` | `Verify` | Paste disclosed lines + proof JSON → verify |

#### Wallet Integration
- **Library:** `ethers.js v6` + `siwe` (Sign-In with Ethereum)
- **Context:** `WalletContext.tsx` provides `address`, `ensName`, `signer`, `connect()`, `disconnect()`
- **Flow:** MetaMask prompt → get signer → create SIWE message → sign → store in context
- ENS reverse lookup attempted (non-fatal if unavailable)

#### API Client (`api/marketplace.ts`)
- All marketplace calls go through `/api/*` → Vite proxy → `:3002`
- Host backend calls go through `/host-api/*` → Vite proxy → `:3001` (strip prefix)
- Typed functions: `listDocuments()`, `getDocument()`, `purchaseSection()`, `purchaseLines()`, `verifyProof()`, `registerHost()`, `listHostDocuments()`, `buildMerkleTree()`, etc.

#### Publish Wizard (5 steps)
1. **Host Connect** — enter host backend URL, verify health, register host
2. **Document Select** — browse Fileverse documents via host backend, select one
3. **Section Define** — view document lines, define named sections with line ranges + prices
4. **Anchor** — build Merkle tree, get root hash, anchor on-chain (manual or automated)
5. **Confirm** — create the marketplace listing with all metadata

---

### 3.5 Smart Contracts (Solidity)

**Location:** `contracts/MerkleAnchor.sol`
**Compiler:** Solidity ^0.8.20
**Target Chain:** Base Sepolia (testnet) / Base Mainnet

#### `MerkleAnchor` Contract
Stores Merkle roots on-chain so buyers can independently verify disclosed content against a tamper-proof fingerprint.

**Functions:**
- `anchorRoot(docId, merkleRoot, totalLeaves)` — Store or update a root (only original host can update)
- `getRoot(docId)` → `(merkleRoot, host, totalLeaves, anchoredAt)`
- `verifyRoot(docId, claimedRoot)` → `bool`
- `totalAnchored()` → `uint256`

**Events:** `RootAnchored`, `RootUpdated`

**Key design:** The `docId` is hashed via `keccak256` for storage key. Only the address that first anchored a document can update its root.

---

## 4. Data Flow: Publish

```
Owner (Frontend)                  Host Backend (:3001)           Marketplace (:3002)         Chain
      │                                │                               │                      │
      │  1. Enter host URL             │                               │                      │
      │  2. POST /health ──────────────►  200 OK                      │                      │
      │  3. POST /api/hosts ───────────────────────────────────────────►  Register host       │
      │                                │                               │  (returns hostId)    │
      │  4. GET /documents ────────────►  List Fileverse docs          │                      │
      │  5. GET /documents/:id ────────►  Full doc + lines             │                      │
      │  6. Define sections in UI      │                               │                      │
      │  7. POST /build-tree ──────────►  Build Merkle tree            │                      │
      │     (returns merkleRoot)       │                               │                      │
      │  8. Anchor root on-chain ──────────────────────────────────────────────────────────────► anchorRoot()
      │  9. POST /api/documents ───────────────────────────────────────►  Create listing       │
      │     (hostId, ddocId, merkleRoot, sections, tags, anchorTx)     │  (returns listingId) │
      │                                │                               │                      │
```

---

## 5. Data Flow: Purchase & Disclosure

```
Buyer (Frontend)              Marketplace (:3002)            Host Backend (:3001)         Fileverse
      │                             │                              │                        │
      │  1. GET /api/documents ─────►  Return listings             │                        │
      │  2. GET /api/documents/:id ─►  Return detail + sections   │                        │
      │                             │                              │                        │
      │  3. POST /api/documents/:id/purchase                      │                        │
      │     Request goes through ──►│                              │                        │
      │                             │  4. Create Purchase record   │                        │
      │                             │  5. POST /disclose ──────────►                        │
      │                             │                              │  6. Fetch doc ─────────► getDocument()
      │                             │                              │  7. Generate proof      │
      │                             │                              │  8. Create partial doc ─► createDocument()
      │                             │                              │  ◄─── newDoc            │
      │                             │  ◄── { disclosedLines,       │                        │
      │                             │       proofPackage,          │                        │
      │                             │       disclosureLink }       │                        │
      │                             │  9. Update Purchase (fulfilled)                       │
      │  ◄── { proofPackage,        │                              │                        │
      │       disclosedLines,       │                              │                        │
      │       merkleRoot,           │                              │                        │
      │       anchorTx, ... }       │                              │                        │
      │                             │                              │                        │
      │  10. Display in UI          │                              │                        │
```

---

## 6. Data Flow: Verification

```
Verifier (Frontend)           Marketplace (:3002)        Host Backend (:3001)         Chain
      │                             │                          │                       │
      │  Option A: Direct verify    │                          │                       │
      │  POST /api/verify ──────────►  Proxy to host ──────────►  verifyDisclosure()  │
      │  ◄── { verified: true/false }                          │                       │
      │                             │                          │                       │
      │  Option B: On-chain root    │                          │                       │
      │  Call MerkleAnchor.getRoot() ──────────────────────────────────────────────────► getRoot()
      │  Compare returned root with proofPackage.original_root │                       │
      │                             │                          │                       │
```

**Verification is free and permissionless.** Anyone with the disclosed lines and proof package can verify authenticity. The on-chain Merkle root provides an independent trust anchor.

---

## 7. Fileverse MCP Integration

DisseK connects to Fileverse's decentralised document storage via the **Model Context Protocol (MCP)**.

### Connection
- **Transport:** `StreamableHTTPClientTransport` from `@modelcontextprotocol/sdk`
- **Endpoint:** Configured via `FILEVERSE_API_URL` env var
- **Client:** Singleton `FileverseClient` class that lazy-connects on first call

### MCP Tools Used
| Tool Name | Purpose |
|-----------|---------|
| `fileverse_list_documents` | List available documents |
| `fileverse_get_document` | Fetch document with content |
| `fileverse_create_document` | Create disclosure document |
| `fileverse_update_document` | Update document content |
| `fileverse_get_sync_status` | Poll blockchain sync status |

### Document Lifecycle
1. Owner creates a document on Fileverse (external)
2. DisseK reads it via MCP `get_document`
3. On disclosure, a new partial document is created via MCP `create_document`
4. The new doc is synced to the blockchain by Fileverse
5. Buyer receives a link to the disclosure document

---

## 8. Merkle Range Proof Scheme

### Tree Construction
1. Split document into `N` lines
2. For each line `i`, generate a deterministic salt: `salt[i] = pad(i.to_le_bytes(), 32)`
3. Hash each leaf: `H(0x00 || be32(i) || line_bytes || salt)`
4. Pad leaf array to next power-of-2 with: `H(0x00 || "PAD" || 0x00×32)`
5. Build binary Merkle tree using `rs_merkle` with domain-separated internal hashing: `H(0x01 || left || right)`

### Proof Generation (Disclosure)
For a contiguous range `[start, end]`:
1. Collect the leaf hashes at those indices
2. Extract the **multi-proof** — the minimal set of sibling hashes needed to reconstruct the root
3. Bundle into a `ProofPackage`:
   ```json
   {
     "original_root": "hex...",
     "total_leaves": 16,
     "range_start": 2,
     "range_end": 5,
     "salts": ["hex...", "hex...", ...],
     "multi_proof": "hex..."
   }
   ```

### Verification
1. Re-hash each disclosed line with its salt and index
2. Feed leaf hashes + multi-proof into `rs_merkle`'s `MerkleProof::verify()`
3. If the reconstructed root matches `original_root`, the lines are authentic

### Security Properties
- **Soundness:** Cannot forge lines that weren't in the original document
- **Privacy:** Undisclosed lines are never revealed; only sibling hashes appear in the proof
- **Binding:** The on-chain anchored root prevents retroactive document modification
- **Domain separation:** Leaf and internal node hashes use different prefixes (`0x00` / `0x01`) to prevent second-preimage attacks

---

## 9. Trust Model

DisseK supports two trust models for document hosts:

### Reputation-Based
- Host starts with a base reputation score (50/100)
- Score increases with successful transactions and verifications
- Suitable for independent researchers, DAOs, anonymous contributors

### Institution-Based
- Host is backed by a named institution (e.g. "Johns Hopkins Hospital")
- Starts with higher base reputation (90/100)
- Institution name displayed in marketplace listings
- Suitable for enterprises, universities, regulated entities

### On-Chain Anchoring
Regardless of trust model, the Merkle root is anchored on-chain via `MerkleAnchor.sol`:
- Provides a tamper-proof reference point
- Anyone can call `verifyRoot(docId, claimedRoot)` to check
- Only the original anchoring address can update a root

---

## 10. Environment Configuration

### Host Backend (`backend/.env`)
```env
FILEVERSE_API_URL=https://your-fileverse-mcp-url/mcp
PORT=3001
```

### Marketplace Backend (`marketplace/.env`)
```env
MARKETPLACE_PORT=3002
# Optional: GOOGLE_APPLICATION_CREDENTIALS for Firestore persistence
```

### Frontend (`frontend/vite.config.ts`)
```typescript
proxy: {
  '/api':      { target: 'http://localhost:3002' },
  '/host-api': { target: 'http://localhost:3001', rewrite: strip prefix },
}
```

---

## 11. Running the System

### Prerequisites
- **Rust + wasm-pack** (for proof engine compilation)
- **Node.js 18+** (for all three servers)
- **MetaMask** browser extension (for wallet connect)

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
# cd backend && npx tsx src/server.ts &
# cd marketplace && npx tsx src/server.ts &
# cd frontend && npx vite --host &
```

### Verify Installation
```bash
curl http://localhost:3001/health   # Host backend
curl http://localhost:3002/api/health  # Marketplace
# Frontend at http://localhost:5173
```
