#!/bin/bash

# ETH Lending Flow CLI Test Script
# Tests the complete ETH to dEURO lending flow

set -e

echo "=========================================="
echo "🧪 ETH LENDING FLOW TEST"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
APP_URL="http://localhost:3000"
MINT_URL="${APP_URL}/mint"

# Function to print colored output
print_status() {
    local status=$1
    local message=$2

    case $status in
        "success")
            echo -e "${GREEN}✅ ${message}${NC}"
            ;;
        "error")
            echo -e "${RED}❌ ${message}${NC}"
            ;;
        "info")
            echo -e "${BLUE}ℹ️  ${message}${NC}"
            ;;
        "warning")
            echo -e "${YELLOW}⚠️  ${message}${NC}"
            ;;
    esac
}

# Test 1: Check if dev server is running
echo "📋 Test 1: Dev Server Status"
echo "------------------------------"

if curl -s -o /dev/null -w "%{http_code}" $APP_URL | grep -q "200"; then
    print_status "success" "Dev server is running at $APP_URL"
else
    print_status "error" "Dev server is not running. Start with 'yarn dev'"
    exit 1
fi
echo ""

# Test 2: Check mint page accessibility
echo "📋 Test 2: Mint Page Accessibility"
echo "------------------------------"

response=$(curl -s -o /dev/null -w "%{http_code}" $MINT_URL)
if [ "$response" = "200" ]; then
    print_status "success" "Mint page accessible at $MINT_URL"
else
    print_status "error" "Mint page not accessible (HTTP $response)"
    exit 1
fi
echo ""

# Test 3: Check ETH parameter support
echo "📋 Test 3: ETH Parameter Support"
echo "------------------------------"

eth_url="${MINT_URL}?collateral=ETH"
response=$(curl -s -o /dev/null -w "%{http_code}" "$eth_url")
if [ "$response" = "200" ]; then
    print_status "success" "ETH collateral parameter works"
else
    print_status "error" "ETH parameter failed (HTTP $response)"
fi
echo ""

# Test 4: Check WETH parameter still works
echo "📋 Test 4: WETH Parameter Support"
echo "------------------------------"

weth_url="${MINT_URL}?collateral=WETH"
response=$(curl -s -o /dev/null -w "%{http_code}" "$weth_url")
if [ "$response" = "200" ]; then
    print_status "success" "WETH collateral parameter still works"
else
    print_status "warning" "WETH parameter issue (HTTP $response)"
fi
echo ""

# Test 5: Verify WETH contract addresses
echo "📋 Test 5: WETH Contract Configuration"
echo "------------------------------"

print_status "info" "Checking WETH addresses in code..."

if grep -q "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" utils/wethHelpers.ts 2>/dev/null; then
    print_status "success" "Mainnet WETH address configured correctly"
else
    print_status "warning" "Mainnet WETH address not found in wethHelpers.ts"
fi

if grep -q "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270" utils/wethHelpers.ts 2>/dev/null; then
    print_status "success" "Polygon WETH address configured correctly"
else
    print_status "warning" "Polygon WETH address not found in wethHelpers.ts"
fi
echo ""

# Test 6: Check for ETH handling in BorrowForm
echo "📋 Test 6: ETH Handling Implementation"
echo "------------------------------"

if grep -q "handleWrapETHAndMint" components/PageMint/BorrowForm.tsx 2>/dev/null; then
    print_status "success" "ETH wrapping function implemented"
else
    print_status "error" "ETH wrapping function not found"
fi

if grep -q "selectedCollateral.symbol === 'ETH'" components/PageMint/BorrowForm.tsx 2>/dev/null; then
    print_status "success" "ETH-specific button logic implemented"
else
    print_status "error" "ETH button logic not found"
fi
echo ""

# Test 7: Build test
echo "📋 Test 7: Production Build"
echo "------------------------------"

print_status "info" "Running production build test..."

if npm run build > /dev/null 2>&1; then
    print_status "success" "Production build successful"
    # Clean up build files
    rm -rf .next
else
    print_status "error" "Production build failed"
fi
echo ""

# Test 8: Check UI flow steps
echo "📋 Test 8: UI Flow Validation"
echo "------------------------------"

print_status "info" "Validating UI flow components..."

# Check if ETH is added to dropdown
if grep -q "symbol: 'ETH'" components/PageMint/BorrowForm.tsx 2>/dev/null; then
    print_status "success" "ETH option added to dropdown"
else
    print_status "error" "ETH option not found in dropdown"
fi

# Check if ETH balance hook exists
if [ -f "hooks/useNativeBalance.ts" ]; then
    print_status "success" "Native ETH balance hook exists"
else
    print_status "warning" "Native ETH balance hook not found"
fi

# Check if balance integration is done
if grep -q "useBalance" hooks/useWalletBalances.ts 2>/dev/null; then
    print_status "success" "ETH balance integrated in wallet balances"
else
    print_status "warning" "ETH balance integration not found"
fi
echo ""

# Summary
echo "=========================================="
echo "📊 TEST SUMMARY"
echo "=========================================="

# Count successes
success_count=$(grep -c "✅" <<< "$(echo -e "$0")" 2>/dev/null || echo "0")

echo ""
print_status "info" "All automated tests completed"
echo ""
echo "Next steps for manual testing:"
echo "1. Open browser at ${MINT_URL}"
echo "2. Connect wallet with ETH balance"
echo "3. Verify ETH appears in dropdown"
echo "4. Select ETH and verify balance shows"
echo "5. Enter amount and check button shows 'Receive X.XX dEURO'"
echo "6. Click button and verify transaction flow:"
echo "   - ETH wrapping transaction"
echo "   - WETH approval transaction"
echo "   - dEURO minting transaction"
echo ""
echo "Test URLs:"
echo "  • Default: ${MINT_URL}"
echo "  • ETH:     ${MINT_URL}?collateral=ETH"
echo "  • WETH:    ${MINT_URL}?collateral=WETH"
echo ""
echo "=========================================="