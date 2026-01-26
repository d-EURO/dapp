#!/bin/bash
# Setup Synpress with MetaMask 13 support for E2E wallet tests
# This script clones the patched version of Synpress that supports MetaMask 13

set -e

SYNPRESS_DIR="/tmp/synpress-dev"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🔧 Setting up Synpress with MetaMask 13 support..."

# Check for pnpm
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm
fi

# Clone or update Synpress
if [ -d "$SYNPRESS_DIR" ]; then
    echo "📂 Synpress directory exists, updating..."
    cd "$SYNPRESS_DIR"
    git fetch origin
    git checkout patch-1 2>/dev/null || git checkout -b patch-1 origin/patch-1
    git pull origin patch-1
else
    echo "📥 Cloning Synpress with MetaMask 13 support..."
    git clone -b patch-1 https://github.com/louis-md/synpress.git "$SYNPRESS_DIR"
    cd "$SYNPRESS_DIR"
fi

# Install dependencies and build
echo "📦 Installing dependencies..."
pnpm install

echo "🔨 Building packages..."
pnpm run build

# Create symlinks in project
echo "🔗 Creating symlinks..."
cd "$PROJECT_DIR"

# Remove existing synpress packages (both symlinks and directories)
rm -rf node_modules/@synthetixio/synpress \
       node_modules/@synthetixio/synpress-cache \
       node_modules/@synthetixio/synpress-core \
       node_modules/@synthetixio/synpress-metamask \
       node_modules/@synthetixio/ethereum-wallet-mock

# Create symlinks for Synpress packages
ln -sfn "$SYNPRESS_DIR/release" node_modules/@synthetixio/synpress
ln -sfn "$SYNPRESS_DIR/packages/cache" node_modules/@synthetixio/synpress-cache
ln -sfn "$SYNPRESS_DIR/packages/core" node_modules/@synthetixio/synpress-core
ln -sfn "$SYNPRESS_DIR/wallets/metamask" node_modules/@synthetixio/synpress-metamask
ln -sfn "$SYNPRESS_DIR/wallets/ethereum-wallet-mock" node_modules/@synthetixio/ethereum-wallet-mock

# Fix Playwright duplicate issue - link Synpress's Playwright to project's Playwright
echo "🔗 Fixing Playwright module resolution..."
PNPM_PW_DIR="$SYNPRESS_DIR/node_modules/.pnpm"
rm -rf "$PNPM_PW_DIR/@playwright+test@1.48.2" "$PNPM_PW_DIR/playwright@1.48.2" "$PNPM_PW_DIR/playwright-core@1.48.2"
mkdir -p "$PNPM_PW_DIR/@playwright+test@1.48.2/node_modules/@playwright"
mkdir -p "$PNPM_PW_DIR/playwright@1.48.2/node_modules"
mkdir -p "$PNPM_PW_DIR/playwright-core@1.48.2/node_modules"
ln -sfn "$PROJECT_DIR/node_modules/@playwright/test" "$PNPM_PW_DIR/@playwright+test@1.48.2/node_modules/@playwright/test"
ln -sfn "$PROJECT_DIR/node_modules/playwright" "$PNPM_PW_DIR/playwright@1.48.2/node_modules/playwright"
ln -sfn "$PROJECT_DIR/node_modules/playwright-core" "$PNPM_PW_DIR/playwright-core@1.48.2/node_modules/playwright-core"

echo "✅ Synpress setup complete!"
echo ""
echo "To run wallet tests:"
echo "  WALLET_SEED_PHRASE=\"your seed phrase\" yarn test:e2e:wallet"
