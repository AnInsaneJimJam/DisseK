# DisseK — Marketplace Backend

Express.js marketplace that aggregates document listings from multiple hosts, handles purchases via x402, and relays disclosure requests.

## Prerequisites

- Node.js ≥ 20
- (Optional) Firebase service account for persistent storage — falls back to in-memory store if not configured

## Install

```bash
npm install

# Configure environment
cp .env.example .env
```

Edit `.env`:

| Variable | Description | Default |
|---|---|---|
| `MARKETPLACE_PORT` | Server port | `3002` |
| `EVM_PAY_TO_ADDRESS` | Your wallet address for x402 payments | — |
| `X402_FACILITATOR_URL` | x402 facilitator | `https://x402.org/facilitator` |
| `X402_NETWORK` | CAIP-2 chain ID | `eip155:84532` (Base Sepolia) |
| `PURCHASE_PRICE` | Price per purchase | `$0.01` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Firebase service account JSON (optional) | — |

## Run

```bash
# Development (hot reload)
npm run dev

# Production
npm start
```

Server starts on `http://localhost:3002`.

## Endpoints

| Method | Path | Paywalled | Description |
|---|---|---|---|
| `POST` | `/api/hosts` | — | Register a new host |
| `GET` | `/api/hosts` | — | List all hosts |
| `POST` | `/api/documents` | — | Create a document listing |
| `GET` | `/api/documents` | — | Browse/search documents |
| `GET` | `/api/documents/:id` | — | Get document details |
| `POST` | `/api/documents/:id/purchase` | x402 | Purchase a section (relays to host) |
| `POST` | `/api/verify` | — | Verify proof against host backend |
| `GET` | `/api/health` | — | Health check |
