import { Address, isAddress } from "viem";

export type QueryValue = string | string[] | undefined;

export type SwapQueryInput = {
	tokenIn?: QueryValue;
	tokenOut?: QueryValue;
	bridge?: QueryValue;
};

export type SwapRoute = {
	fromSymbol?: string;
	toSymbol?: string;
	bridge?: Address;
};

const readQueryValue = (value: QueryValue): string | undefined => {
	const raw = Array.isArray(value) ? value[0] : value;
	if (raw === undefined) return undefined;
	const trimmed = raw.trim();
	if (trimmed === "") return undefined;
	return trimmed;
};

const resolveSymbol = (value: string | undefined, knownStablecoinSymbols: readonly string[], deuroSymbol: string): string | undefined => {
	if (value === undefined) return undefined;
	const normalized = value.toLowerCase();
	const stablecoin = knownStablecoinSymbols.find((symbol) => symbol.toLowerCase() === normalized);
	if (stablecoin !== undefined) return stablecoin;
	if (deuroSymbol.toLowerCase() === normalized) return deuroSymbol;
	return undefined;
};

export function parseSwapQuery(query: SwapQueryInput, knownStablecoinSymbols: readonly string[], deuroSymbol: string): SwapRoute {
	const tokenInText = readQueryValue(query.tokenIn);
	const tokenOutText = readQueryValue(query.tokenOut);
	const bridgeText = readQueryValue(query.bridge);
	const tokenIn = resolveSymbol(tokenInText, knownStablecoinSymbols, deuroSymbol);
	const tokenOut = resolveSymbol(tokenOutText, knownStablecoinSymbols, deuroSymbol);
	const route: SwapRoute = {};

	if (tokenOut !== undefined && knownStablecoinSymbols.includes(tokenOut) && (tokenInText === undefined || tokenIn === deuroSymbol)) {
		route.fromSymbol = deuroSymbol;
		route.toSymbol = tokenOut;
	} else if (tokenOut === deuroSymbol && tokenIn !== undefined && knownStablecoinSymbols.includes(tokenIn)) {
		route.fromSymbol = tokenIn;
		route.toSymbol = deuroSymbol;
	}

	if (bridgeText !== undefined && isAddress(bridgeText)) {
		route.bridge = bridgeText;
	}

	return route;
}
