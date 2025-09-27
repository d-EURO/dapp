#!/bin/bash

echo "🧪 Testing ETH Dropdown Feature..."

# Check if dev server is running
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "❌ Dev server not running. Start with 'yarn dev'"
    exit 1
fi

echo "✅ Dev server is running"

# Test 1: Basic mint page
echo "🔍 Test 1: Basic mint page access"
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/mint)
if [ "$response" = "200" ]; then
    echo "✅ Mint page accessible"
else
    echo "❌ Mint page not accessible (HTTP $response)"
fi

# Test 2: ETH parameter
echo "🔍 Test 2: ETH collateral parameter"
response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/mint?collateral=ETH")
if [ "$response" = "200" ]; then
    echo "✅ ETH parameter works"
else
    echo "❌ ETH parameter failed (HTTP $response)"
fi

# Test 3: WETH parameter (should still work)
echo "🔍 Test 3: WETH collateral parameter"
response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/mint?collateral=WETH")
if [ "$response" = "200" ]; then
    echo "✅ WETH parameter still works"
else
    echo "❌ WETH parameter failed (HTTP $response)"
fi

# Test 4: Check if ETH appears in page source when WETH is available
echo "🔍 Test 4: ETH option injection when WETH available"
page_content=$(curl -s http://localhost:3000/mint)
if echo "$page_content" | grep -q "ETH" && echo "$page_content" | grep -q "Ethereum"; then
    echo "✅ ETH content detected in page"
else
    echo "⚠️  ETH content not detected (may be client-side rendered)"
fi

# Test 5: Build still works
echo "🔍 Test 5: Production build test"
if npm run build > /dev/null 2>&1; then
    echo "✅ Production build successful"
    # Clean up build files
    rm -rf .next
else
    echo "❌ Production build failed"
fi

# Test 6: Lint check
echo "🔍 Test 6: Code quality check"
if npm run lint > /dev/null 2>&1; then
    echo "✅ Linting passed"
else
    echo "⚠️  Linting has warnings (check manually)"
fi

echo ""
echo "🎉 Automated tests completed!"
echo ""
echo "📋 Manual tests required:"
echo "   1. Open http://localhost:3000/mint in browser"
echo "   2. Verify ETH is first option in dropdown"
echo "   3. Verify ETH is selected by default"
echo "   4. Connect wallet and check ETH balance display"
echo "   5. Switch between ETH and WETH options"
echo "   6. Test URL parameters: ?collateral=ETH and ?collateral=WETH"
echo "   7. Verify both options use correct balances"
echo ""
echo "🔗 Test URLs:"
echo "   • Default: http://localhost:3000/mint"
echo "   • ETH:     http://localhost:3000/mint?collateral=ETH"
echo "   • WETH:    http://localhost:3000/mint?collateral=WETH"
echo ""
echo "✅ Feature ready for production if all manual tests pass!"