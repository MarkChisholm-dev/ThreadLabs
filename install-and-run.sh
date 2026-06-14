#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "============================================"
echo "ThreadLabs - Install and Run"
echo "============================================"
echo

if ! command -v npm >/dev/null 2>&1; then
  echo "[ERROR] npm was not found in PATH."
  echo "Install Node.js (includes npm): https://nodejs.org/"
  exit 1
fi

echo "[1/2] Installing dependencies..."
npm install

echo
echo "[2/2] Starting development servers..."
echo "App: http://localhost:5173"
echo "API: http://localhost:4000"
echo
echo "Press Ctrl+C to stop."
echo

npm run dev
