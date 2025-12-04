import { formatUnits } from "viem";
import { formatCurrency } from "./format";

export const getDisplayDecimals = (unit: string): number => {
	const stablecoins = ["JUSD", "DEURO"];
	return stablecoins.includes(unit.toUpperCase()) ? 2 : 8;
};

export const formatPositionValue = (value: bigint, decimals: number, unit: string): string => {
	return `${formatCurrency(formatUnits(value, decimals), 0, getDisplayDecimals(unit))} ${unit}`;
};

export const formatPositionDelta = (delta: bigint, decimals: number, unit: string): string => {
	if (delta === 0n) return "No change";
	const prefix = delta > 0n ? "+" : "";
	return prefix + formatPositionValue(Math.abs(Number(delta)) === Number(delta) ? delta : -delta, decimals, unit);
};
