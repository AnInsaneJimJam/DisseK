# DisseK — Frontend

React + TypeScript + Vite frontend for the DisseK marketplace. Supports wallet connection (MetaMask + SIWE), x402 payments, and on-chain proof verification.

## Prerequisites

- Node.js ≥ 20
- MetaMask browser extension (for wallet connection & x402 payments)
- Backend running on port `3001`
- Marketplace running on port `3002`

## Install

```bash
npm install
```

## Run

```bash
# Development (hot reload)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

Dev server starts on `http://localhost:5173`.

## Vite Proxy

The dev server proxies API requests:

| Path | Target |
|---|---|
| `/api/*` | `http://localhost:3002` (marketplace) |
| `/host-api/*` | `http://localhost:3001` (host backend) |

## Key Pages

| Route | Description |
|---|---|
| `/` | Landing page |
| `/marketplace` | Browse listed documents |
| `/documents/:id` | View document, purchase sections via x402, verify proofs |
| `/publish` | Multi-step wizard to list a document |
| `/verify` | Standalone proof verification tool |
