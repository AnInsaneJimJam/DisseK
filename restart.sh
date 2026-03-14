#!/usr/bin/env bash
# Restart all three DisseK servers: backend (3001), marketplace (3002), frontend (5173)

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🔄 Stopping existing servers..."
kill $(lsof -i :3001 -t) 2>/dev/null && echo "  Killed backend (3001)" || echo "  Backend (3001) not running"
kill $(lsof -i :3002 -t) 2>/dev/null && echo "  Killed marketplace (3002)" || echo "  Marketplace (3002) not running"
kill $(lsof -i :5173 -t) 2>/dev/null && echo "  Killed frontend (5173)" || echo "  Frontend (5173) not running"
sleep 1

echo ""
echo "🚀 Starting backend (port 3001)..."
cd "$ROOT/backend" && npx tsx src/server.ts &
sleep 2

echo "🚀 Starting marketplace (port 3002)..."
cd "$ROOT/marketplace" && npx tsx src/server.ts &
sleep 2

echo "🚀 Starting frontend (port 5173)..."
cd "$ROOT/frontend" && npx vite --host &
sleep 2

echo ""
echo "✅ All servers started:"
echo "  Backend:     http://localhost:3001"
echo "  Marketplace: http://localhost:3002"
echo "  Frontend:    http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all servers."
wait
