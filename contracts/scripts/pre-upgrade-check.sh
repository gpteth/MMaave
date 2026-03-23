#!/bin/bash
set -euo pipefail

if [ -f .env ]; then
  source .env
else
  echo "ERROR: .env file not found"
  exit 1
fi

echo "=== Pre-Upgrade Safety Checklist ==="
echo ""

echo "1. Running all tests..."
forge test -vvv || { echo "FAIL: Tests did not pass"; exit 1; }
echo "PASS"
echo ""

echo "2. Checking storage layout..."
forge inspect src/core/MemePlus.sol:MemePlus storage-layout > /tmp/new-storage-layout.txt
echo "   Storage layout saved to /tmp/new-storage-layout.txt"
echo "   Review for any slot changes before proceeding."
echo ""

echo "3. Simulating upgrade (dry run)..."
forge script script/UpgradeMemePlus.s.sol:UpgradeMemePlus \
  --rpc-url "$BSC_RPC_URL" -vvv || { echo "FAIL: Simulation failed"; exit 1; }
echo "PASS"
echo ""

echo "=== All checks passed ==="
echo "To execute: ./upgrade.sh"
