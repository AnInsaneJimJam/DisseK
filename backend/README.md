# DisseK — Host Backend

Express.js server for selective disclosure of Fileverse dDocs using Merkle Range Proofs, paywalled with x402.

## Prerequisites

- Node.js ≥ 20
- Rust WASM proof engine compiled (see `../proof-engine/README.md`)

## Install

```bash
# Build the proof engine first (one-time)
cd ../proof-engine && wasm-pack build --target nodejs --out-dir pkg && cd ../backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
```

Edit `.env`:

| Variable | Description | Default |
|---|---|---|
| `FILEVERSE_API_URL` | Fileverse MCP server URL | `http://localhost:3000` |
| `PORT` | Server port | `3001` |
| `EVM_PAY_TO_ADDRESS` | Your wallet address for x402 payments | — |
| `X402_FACILITATOR_URL` | x402 facilitator | `https://x402.org/facilitator` |
| `X402_NETWORK` | CAIP-2 chain ID | `eip155:84532` (Base Sepolia) |
| `DISCLOSURE_PRICE` | Price per disclosure | `$0.01` |

## Run

```bash
# Development (hot reload)
npm run dev

# Production
npm start
```

Server starts on `http://localhost:3001`.

## Endpoints

| Method | Path | Paywalled | Description |
|---|---|---|---|
| `POST` | `/disclose` | x402 | Generate selective disclosure |
| `POST` | `/disclose-direct` | — | Disclosure from raw content |
| `POST` | `/verify` | — | Verify disclosed lines against Merkle root |
| `POST` | `/build-tree` | — | Build Merkle tree for a document |
| `GET` | `/documents` | — | List Fileverse documents |
| `GET` | `/documents/:ddocId` | — | Get document metadata |
| `GET` | `/health` | — | Health check |
