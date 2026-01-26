import { formatUnits } from "viem";
import { formatCurrency } from "./format";

// For INPUT fields - allows precise entry (8 decimals for collateral)
export const getDisplayDecimals = (unit: string): number => {
	const protocolTokens = ["JUSD", "USD", "JUICE", "SVJUSD", "SUSD"];
	return protocolTokens.includes(unit.toUpperCase()) ? 2 : 8;
};

// For DISPLAY only - Collateral: 3 decimals, JUSD/USD: 2 decimals
export const getDisplayDecimalsForDisplay = (unit: string): number => {
	const protocolTokens = ["JUSD", "USD", "JUICE", "SVJUSD", "SUSD"];
	return protocolTokens.includes(unit.toUpperCase()) ? 2 : 3;
};

export const formatPositionValue = (value: bigint, decimals: number, unit: string): string => {
	const displayDecimals = getDisplayDecimalsForDisplay(unit);
	return `${formatCurrency(formatUnits(value, decimals), displayDecimals, displayDecimals)} ${unit}`;
};

export const formatPositionDelta = (delta: bigint, decimals: number, unit: string): string => {
	if (delta === 0n) return "No change";
	const prefix = delta > 0n ? "+" : "";
	return prefix + formatPositionValue(Math.abs(Number(delta)) === Number(delta) ? delta : -delta, decimals, unit);
};
