# DisseK Backend

Express.js backend for selective disclosure of Fileverse dDocs using Merkle Range Proofs.

## How It Works

1. **Owner** sends `POST /disclose` with `{ ddocId, startLine, endLine }`
2. Backend fetches the full document from the Fileverse API
3. The Rust WASM proof engine builds a Merkle tree over all lines
4. It extracts a multi-proof for the selected line range
5. A new partial document is created on Fileverse containing only the disclosed lines + proof package
6. **Bob** can verify the disclosed lines against the authoritative Merkle root using `POST /verify`

## Setup

```bash
# Prerequisites: Rust WASM must be compiled first
cd ../proof-engine && wasm-pack build --target nodejs --out-dir pkg && cd ../backend

# Install dependencies
npm install

# Copy and configure env
cp .env.example .env
# Edit .env with your FILEVERSE_API_URL
```

## Run

```bash
# Development (with hot reload)
npm run dev

# Production
npm start

# Test proof engine locally (no Fileverse API needed)
npm run test-flow
```

## API Endpoints

### `POST /disclose`
Generate a selective disclosure from a Fileverse document.

**Request:**
```json
{ "ddocId": "abc123", "startLine": 0, "endLine": 5 }
```
Requires `FILEVERSE_API_URL` env var.

### `POST /disclose-direct`
Same as `/disclose` but accepts document content directly (no Fileverse fetch needed).

**Request:**
```json
{ "content": "line1\nline2\nline3", "startLine": 0, "endLine": 1, "title": "My Doc" }
```

### `POST /verify`
Verify that disclosed lines match the original document's Merkle root.

**Request:**
```json
{
  "disclosedLines": ["line1", "line2"],
  "proofPackage": {
    "original_root": "...",
    "total_leaves": 16,
    "range_start": 0,
    "range_end": 1,
    "salts": ["..."],
    "multi_proof": "..."
  }
}
```

### `GET /health`
Health check.
