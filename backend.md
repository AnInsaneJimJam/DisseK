# DisseK Backend — Deep Dive

Express.js + TypeScript service running on port 3001. It bridges the Rust WASM proof engine with the Fileverse MCP API.

---

## Directory Layout

```
backend/
├── src/
│   ├── server.ts           # Express app — all HTTP routes
│   ├── proof-service.ts    # WASM wrapper — generateDisclosure / verifyDisclosure
│   ├── fileverse-client.ts # MCP SDK client (singleton) — reads/writes Fileverse dDocs
│   ├── test-flow.ts        # Local E2E proof test (no Fileverse needed)
│   ├── mcp-e2e-test.ts     # Simulated full disclosure flow with real ddocId
│   └── test-mcp-client.ts  # MCP connectivity smoke test
├── .env                    # FILEVERSE_API_URL + PORT (gitignored)
├── .env.example            # Template
├── package.json            # "proof-engine": "file:../proof-engine/pkg"
└── tsconfig.json
```

The `proof-engine` dependency is the wasm-pack output at `../proof-engine/pkg` — a local file reference, not an npm package.

---

## `server.ts` — HTTP Layer

The entry point. Creates an Express app, instantiates a **singleton** `FileverseClient`, and exposes four routes.

### Singleton pattern

```ts
let _fvClient: FileverseClient | null = null;
function getFileverseClient(): FileverseClient {
  if (!_fvClient) _fvClient = new FileverseClient();
  return _fvClient;
}
```

One persistent MCP connection is reused across all requests. Without this, every request would open a new Cloudflare worker connection and hit the Error 1102 resource limit.

---

### `POST /disclose` — Full Fileverse flow

**Purpose:** Owner discloses a range of lines from an existing Fileverse dDoc.

**Request body:**
```json
{ "ddocId": "tdJsPVnnZxN6JG2keVhjMN", "startLine": 2, "endLine": 5 }
```

**Steps internally:**
1. `client.getDocument(ddocId)` — fetches full encrypted doc via MCP
2. `generateDisclosure(content, start, end)` — runs WASM, builds Merkle tree, extracts proof
3. Builds a clean markdown body with only the disclosed lines (no proof embedded)
4. `client.createDocument(title, partialContent)` — creates a new dDoc on Fileverse
5. Returns the new doc link **plus** the `proofPackage` in the JSON response

**Key design decision:** The proof package is **not** stored inside the Fileverse dDoc. The dDoc contains only the clean human-readable disclosed lines. The proof lives in the API response and must be stored by the caller (frontend) and passed to `/verify` later.

**Response:**
```json
{
  "success": true,
  "originalDocId": "tdJsPVnnZxN6JG2keVhjMN",
  "disclosureDocId": "tEKBoBgxFdFxHfMEmBGCkh",
  "disclosureLink": "https://docs.fileverse.io/...",
  "syncStatus": "synced",
  "linesDisclosed": 4,
  "proofPackage": {
    "original_root": "51749c54...",
    "total_leaves": 16,
    "range_start": 2,
    "range_end": 5,
    "salts": ["0200...0000", ...],
    "multi_proof": "c6249a9c..."
  }
}
```

---

### `POST /disclose-direct` — Content-first flow

**Purpose:** Same as `/disclose` but the caller provides document content directly, skipping the Fileverse fetch. No Fileverse dDoc is created.

**Request body:**
```json
{ "content": "line0\nline1\nline2\n...", "startLine": 0, "endLine": 4, "title": "My Doc" }
```

**Response adds:**
```json
{
  "disclosedLines": ["line0", "line1", ...],
  "partialDocumentMarkdown": "# Selective Disclosure: ...",
  ...
}
```

Useful for the Publish flow where the frontend already has the document content (extracted from Fileverse DOM) and just needs the proof.

---

### `POST /verify` — Proof verification

**Purpose:** Verifies a previously generated proof package against a set of disclosed lines.

**Request body:**
```json
{
  "disclosedLines": ["line2", "line3", "line4", "line5"],
  "proofPackage": {
    "original_root": "51749c54...",
    "total_leaves": 16,
    "range_start": 2,
    "range_end": 5,
    "salts": [...],
    "multi_proof": "..."
  }
}
```

**Response:**
```json
{
  "verified": true,
  "message": "The disclosed lines are cryptographically proven to be part of the original document."
}
```

Internally calls `DocumentTree.verify_range(root, rangeStart, lines, salts, proofBytes, totalLeaves)` via WASM.

**Note:** This endpoint exists as a convenience. Ideally verification should run client-side in the browser using the WASM compiled with `--target web` so the user doesn't need to trust the backend.

---

### `GET /health`

```json
{ "status": "ok", "engine": "DisseK Selective Disclosure Backend" }
```

---

## `proof-service.ts` — WASM Wrapper

Imports `DocumentTree` from the `proof-engine` CJS module (wasm-pack output). Exports two functions:

### `generateDisclosure(content, startLine, endLine): DisclosureResult`

1. Splits content by `\n` → array of lines
2. `new DocumentTree(lines)` — builds the full Merkle tree in WASM (padded to next power of 2)
3. For each line in `[startLine, endLine]`:
   - Pushes `lines[i]` to `disclosedLines`
   - Gets `docTree.get_salt(i)` → hex-encodes it → pushes to `salts`
4. `docTree.extract_range_proof(startLine, endLine)` → hex-encoded `multi_proof`
5. Calls `docTree.free()` to release WASM memory
6. Returns `{ disclosedLines, proofPackage }`

### `verifyDisclosure(disclosedLines, proofPackage): boolean`

1. Decodes `original_root`, `multi_proof`, and all `salts` from hex to `Uint8Array`
2. Calls `DocumentTree.verify_range(root, rangeStart, lines, salts, proofBytes, totalLeaves)`
3. Returns `true` / `false`

### `ProofPackage` interface

```ts
interface ProofPackage {
  original_root: string;   // hex SHA-256 Merkle root (32 bytes)
  total_leaves: number;    // padded leaf count (always a power of 2)
  range_start: number;     // 0-indexed inclusive
  range_end: number;       // 0-indexed inclusive
  salts: string[];         // hex 32-byte salt per disclosed line
  multi_proof: string;     // hex-encoded rs_merkle multi-proof bytes
}
```

---

## `fileverse-client.ts` — MCP Client

Wraps the `@modelcontextprotocol/sdk` to talk to the Fileverse Cloudflare worker at `FILEVERSE_API_URL`.

### Connection model

Uses `StreamableHTTPClientTransport` with lazy connect (`ensureConnected()` on first call). After the first call, `this.connected = true` and subsequent calls reuse the same transport.

### Tool calls → JSON

All Fileverse MCP tools return `content: [{ type: "text", text: "..." }]`. The private `callTool` method extracts the first `text` item and `JSON.parse`s it.

### Available methods

| Method | MCP Tool | Description |
|---|---|---|
| `listDocuments(limit, skip)` | `fileverse_list_documents` | Paginated doc list |
| `getDocument(ddocId)` | `fileverse_get_document` | Fetch single doc with content |
| `createDocument(title, content)` | `fileverse_create_document` | Create new dDoc |
| `updateDocument(ddocId, updates)` | `fileverse_update_document` | Patch title or content |
| `getSyncStatus(ddocId)` | `fileverse_get_sync_status` | Check on-chain sync |
| `waitForSync(ddocId, timeout, interval)` | polls `getDocument` | Waits until `syncStatus === "synced"` |
| `disconnect()` | — | Closes the MCP client |

### `FileverseDocument` shape

```ts
interface FileverseDocument {
  ddocId: string;
  title: string;
  content: string;
  syncStatus: "pending" | "synced" | "failed";
  link: string | null;         // null while pending
  localVersion: number;
  onchainVersion: number;
  createdAt: string;
  updatedAt: string;
}
```

---

## Test Files

### `test-flow.ts`

Pure local proof engine test. No network calls. Runs three scenarios:
1. Generate proof for lines 0–4 of a hardcoded document, verify → expected VALID
2. Tamper with a disclosed line → expected INVALID
3. Shift `range_start` by 1 → expected INVALID

Run: `npm run test-flow`

### `test-mcp-client.ts`

Connects to the live Fileverse MCP server, calls `listDocuments(5)`, then `getDocument` on the first result. Verifies the client can connect, list, and fetch. Run: `npx tsx src/test-mcp-client.ts`

### `mcp-e2e-test.ts`

Simulates the full `/disclose` flow with the real content of `tdJsPVnnZxN6JG2keVhjMN` (hardcoded). Generates a disclosure for lines 0–5, verifies it, and prints the markdown that would be uploaded to Fileverse. Useful for inspecting the proof package without spinning up the HTTP server.

---

## Environment Variables

| Variable | Description |
|---|---|
| `FILEVERSE_API_URL` | MCP server URL (Fileverse Cloudflare worker) |
| `PORT` | HTTP port (default: 3001) |

`.env` example:
```
FILEVERSE_API_URL=https://fileverse-cloudflare-worker-1.sohamvijayop1.workers.dev/mcp
PORT=3001
```

---

## How to Run

```bash
# Prerequisites: compile WASM first (only once, or after Rust changes)
cd ../proof-engine && wasm-pack build --target nodejs --out-dir pkg

# Install dependencies
cd ../backend && npm install

# Start server
npm start               # production
npm run dev             # hot-reload with tsx watch

# Tests
npm run test-flow       # local proof engine test (no Fileverse)
npx tsx src/test-mcp-client.ts   # MCP connectivity check
```

---

## Merkle Proof Internals (Quick Reference)

- **Leaf hash:** `SHA256(0x00 || index_be_bytes || line_bytes || salt_bytes)`
- **Internal node:** `SHA256(0x01 || left_child || right_child)`
- **Padding leaf:** `SHA256(0x00 || "PAD" || 0x00*32)` — fills tree to next power of 2
- **Salt:** Currently deterministic (`salt[0..4] = index.to_le_bytes()`). Production should use secure RNG.
- **Proof type:** `rs_merkle` multi-proof (log n sibling hashes for a contiguous range)
