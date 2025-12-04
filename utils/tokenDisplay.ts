export function normalizeTokenSymbol(symbol: string): string {
	const normalized = symbol.toLowerCase();
	if (normalized === "wcbtc" || normalized === "wcbtc") {
		return "cBTC";
	}
	return symbol;
}
export function isNativeWrappedToken(symbol: string): boolean {
	const normalized = symbol.toLowerCase();
	return normalized === "wcbtc";
}
