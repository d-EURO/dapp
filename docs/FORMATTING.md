# Formatting Rules

## Important: Display vs Input

| Context                     | Rule                                                                             |
| --------------------------- | -------------------------------------------------------------------------------- |
| **Display (read-only)**     | Apply decimal formatting rules below                                             |
| **Input fields (editable)** | **NO restrictions** - users must be able to enter any number with full precision |

**Critical**: Input fields must never restrict the number of decimal places a user can enter. The formatting rules only apply to displaying values, not to user input.

## Display Decimal Places

Use `formatCurrency(value, minDecimals, maxDecimals)` for **display only**:

| Type                                                 | Decimals | Example                       |
| ---------------------------------------------------- | -------- | ----------------------------- |
| **Protocol tokens** (JUSD, JUICE, svJUSD, SUSD, USD) | `(2, 2)` | `150.00 JUSD`, `100.00 JUICE` |
| **Collateral** (cBTC, WcBTC, ETH, etc.)              | `(3, 3)` | `0.500 cBTC`                  |
| **Percent**                                          | `(0, 2)` | `5%`, `5.5%`, `5.55%`         |

## Helper Functions

For dynamic token handling in **display contexts**, use the `getDisplayPrecision` helper:

```tsx
const getDisplayPrecision = (symbol?: string): [number, number] => {
	const protocolTokens = ["JUSD", "USD", "JUICE", "SVJUSD", "SUSD"];
	if (symbol && protocolTokens.includes(symbol.toUpperCase())) return [2, 2];
	return [3, 3];
};

// Usage for DISPLAY only
formatCurrency(value, ...getDisplayPrecision(symbol));
```

## Components

### Display Components

-   **DisplayAmount**: Automatically applies formatting rules based on the `currency` prop
-   **Balance displays**: Use `getDisplayPrecision` for showing wallet balances

### Input Components

-   **TokenInput / TokenInputSelect / BigNumberInput**: Must accept any decimal precision
-   **Never restrict** decimal places in input fields
-   Formatting rules only apply to the balance display within these components, not to the input value itself
