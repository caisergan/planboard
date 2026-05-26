#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

PORT="${PLANBOARD_PORT:-8080}"
FRONTEND_PORT="${PLANBOARD_FRONTEND_PORT:-5173}"

cleanup() {
  echo ""
  echo "Shutting down..."
  kill $BACKEND_PID 2>/dev/null
  kill $FRONTEND_PID 2>/dev/null
  wait $BACKEND_PID 2>/dev/null
  wait $FRONTEND_PID 2>/dev/null
  echo "Done."
}
trap cleanup EXIT INT TERM

if [ ! -f frontend/node_modules/.package-lock.json ]; then
  echo "Installing frontend dependencies..."
  cd frontend && npm install && cd ..
fi

CONFIG_PATH="$HOME/.config/planboard/config.json"
if [ ! -f "$CONFIG_PATH" ]; then
  echo "No config found. Creating default..."
  go run ./cmd/planboard -- --init
fi

echo "Starting backend on :$PORT"
PLANBOARD_DEV=1 go run ./cmd/planboard &
BACKEND_PID=$!

echo "Starting frontend on :$FRONTEND_PORT"
cd frontend && PORT=$FRONTEND_PORT npx vite --port "$FRONTEND_PORT" &
FRONTEND_PID=$!
cd ..

echo ""
echo "Planboard is running:"
echo "  Dashboard: http://localhost:$FRONTEND_PORT"
echo "  API:       http://localhost:$PORT"
echo ""
echo "Press Ctrl+C to stop."

wait
