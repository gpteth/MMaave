#!/bin/bash
set -euo pipefail

# Load environment variables from .env
if [ -f .env ]; then
  source .env
else
  echo "ERROR: .env file not found. Copy .env.example and fill in values."
  exit 1
fi

if [ -z "${BSC_RPC_URL:-}" ] || [ -z "${BSCSCAN_API_KEY:-}" ]; then
  echo "ERROR: BSC_RPC_URL and BSCSCAN_API_KEY must be set in .env"
  exit 1
fi

echo "========== Step 1: Upgrade Meme =========="
forge script script/UpgradeInvestmentFacet.s.sol:UpgradeInvestmentFacet \
  --rpc-url "$BSC_RPC_URL" \
  --broadcast \
  -vvv \
  --verify \
  --slow \
  --etherscan-api-key "$BSCSCAN_API_KEY"

# echo ""
# echo "========== Step 2: Deploy MintBlueReader (UUPS) =========="
# forge script script/DeployMintBlueReader.s.sol:DeployMintBlueReader \
#   --rpc-url "$RPC_URL" \
#   --broadcast \
#   -vvv \
#   --verify \
#   --slow \
#   --etherscan-api-key "$ETHERSCAN_API_KEY"
