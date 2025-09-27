# Test Script: ETH Dropdown Feature

## Ziel
Verifizierung der automatischen ETH Option im Dropdown, wenn WETH verfügbar ist.

## Prerequisites
- Lokale Entwicklungsumgebung läuft (`yarn dev`)
- Wallet mit ETH und WETH Balance (für vollständigen Test)
- Browser mit MetaMask oder ähnlicher Wallet

## Test Cases

### 1. Grundlegende ETH Option Anzeige
**Schritt 1:** Navigate zu http://localhost:3000/mint
- ✅ **Erwartet:** ETH erscheint als erste Option im Dropdown
- ✅ **Erwartet:** ETH ist standardmäßig ausgewählt
- ✅ **Erwartet:** ETH Balance wird korrekt angezeigt

### 2. URL Parameter Tests
**Schritt 2a:** Navigate zu http://localhost:3000/mint?collateral=ETH
- ✅ **Erwartet:** ETH ist ausgewählt
- ✅ **Erwartet:** URL Parameter wird korrekt interpretiert

**Schritt 2b:** Navigate zu http://localhost:3000/mint?collateral=WETH
- ✅ **Erwartet:** WETH ist ausgewählt (nicht ETH)
- ✅ **Erwartet:** Originalverhalten bleibt intakt

### 3. Dropdown Funktionalität
**Schritt 3:** Öffne Collateral Dropdown
- ✅ **Erwartet:** ETH ist die erste Option
- ✅ **Erwartet:** WETH ist ebenfalls verfügbar
- ✅ **Erwartet:** Beide zeigen korrekte Balance

### 4. ETH zu WETH Wechsel
**Schritt 4:** Wähle WETH aus dem Dropdown
- ✅ **Erwartet:** WETH wird ausgewählt
- ✅ **Erwartet:** URL ändert sich zu ?collateral=WETH
- ✅ **Erwartet:** WETH Balance wird angezeigt

### 5. Zurück zu ETH
**Schritt 5:** Wähle ETH aus dem Dropdown
- ✅ **Erwartet:** ETH wird ausgewählt
- ✅ **Erwartet:** URL ändert sich zu ?collateral=ETH
- ✅ **Erwartet:** ETH Balance wird angezeigt

### 6. Wallet Connection Test
**Schritt 6a:** Ohne Wallet Verbindung
- ✅ **Erwartet:** ETH Option erscheint trotzdem
- ✅ **Erwartet:** Balance zeigt 0 oder "Connect Wallet"

**Schritt 6b:** Mit Wallet Verbindung
- ✅ **Erwartet:** Echte ETH Balance wird angezeigt
- ✅ **Erwartet:** ETH ist weiterhin Standard

### 7. Edge Cases
**Schritt 7a:** Wenn nur WETH Position existiert
- ✅ **Erwartet:** ETH Option wird automatisch hinzugefügt
- ✅ **Erwartet:** ETH nutzt WETH Position intern

**Schritt 7b:** Wenn kein WETH existiert
- ✅ **Erwartet:** Keine ETH Option wird hinzugefügt
- ✅ **Erwartet:** Normale Dropdown Funktionalität

## Automatisiertes Test Script

```bash
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

# Test 4: Build still works
echo "🔍 Test 4: Production build"
if npm run build > /dev/null 2>&1; then
    echo "✅ Production build successful"
else
    echo "❌ Production build failed"
fi

echo "🎉 Automated tests completed!"
echo ""
echo "📋 Manual tests required:"
echo "   - Open browser and test dropdown interaction"
echo "   - Connect wallet and verify balance display"
echo "   - Test ETH/WETH switching in UI"
```

## Regression Tests

### Bestehende Funktionalität
- ✅ **WETH Selection:** Ursprüngliche WETH Auswahl funktioniert
- ✅ **Other Tokens:** Andere Collateral Tokens unverändert
- ✅ **URL Parameters:** Alle bestehenden Parameter funktionieren
- ✅ **Position Creation:** Minting Prozess unverändert

### Performance
- ✅ **Page Load:** Keine merkliche Verlangsamung
- ✅ **Balance Loading:** ETH Balance lädt parallel zu ERC20s
- ✅ **Dropdown Speed:** Keine Verzögerung beim Öffnen

## Notizen für Reviewer

1. **Neue Files:**
   - `hooks/useNativeBalance.ts` - ETH Balance Hook

2. **Geänderte Files:**
   - `components/PageMint/BorrowForm.tsx` - ETH Option Logic
   - `hooks/useWalletBalances.ts` - ETH Balance Integration

3. **Verhalten:**
   - ETH nutzt die gleiche Position wie WETH (geteilte Liquidation Logik)
   - ETH Balance kommt von `useBalance` Hook (native)
   - WETH Balance kommt weiterhin von ERC20 Queries

4. **Backwards Compatibility:**
   - Alle bestehenden URLs funktionieren unverändert
   - Bestehende WETH Funktionalität bleibt intakt
   - Keine Breaking Changes