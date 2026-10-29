import { test, expect } from "@playwright/test";
import { Address } from "viem";
import { parseSwapQuery } from "../utils/swapQuery";

const knownStablecoinSymbols = ["EURC", "EURS"];
const deuroSymbol = "dEURO";
const bridge: Address = "0xB4fF7412f08C22d7381885e8BdA9EE9825092fd1";

test.describe("parseSwapQuery", () => {
	test("sets from dEURO to EURC when tokenOut is EURC", () => {
		const route = parseSwapQuery({ tokenOut: "EURC" }, knownStablecoinSymbols, deuroSymbol);
		expect(route.fromSymbol).toBe("dEURO");
		expect(route.toSymbol).toBe("EURC");
	});

	test("canonicalizes a lowercase tokenOut to the known symbol", () => {
		const route = parseSwapQuery({ tokenOut: "eurc" }, knownStablecoinSymbols, deuroSymbol);
		expect(route.fromSymbol).toBe("dEURO");
		expect(route.toSymbol).toBe("EURC");
	});

	test("sets from EURC to dEURO when tokenOut is dEURO and tokenIn is EURC", () => {
		const route = parseSwapQuery({ tokenIn: "EURC", tokenOut: "dEURO" }, knownStablecoinSymbols, deuroSymbol);
		expect(route.fromSymbol).toBe("EURC");
		expect(route.toSymbol).toBe("dEURO");
	});

	test("returns a valid bridge address unchanged", () => {
		const route = parseSwapQuery({ bridge: `  ${bridge}  ` }, knownStablecoinSymbols, deuroSymbol);
		expect(route.bridge).toBe(bridge);
	});

	test("omits a bridge value that is not an address", () => {
		const route = parseSwapQuery({ tokenOut: "EURC", bridge: "not-an-address" }, knownStablecoinSymbols, deuroSymbol);
		expect(route.fromSymbol).toBe("dEURO");
		expect(route.toSymbol).toBe("EURC");
		expect(route.bridge).toBeUndefined();
	});

	test("uses only the first value of an array", () => {
		const other: Address = "0x0000000000000000000000000000000000000002";
		const route = parseSwapQuery(
			{
				tokenOut: ["EURC", "EURS"],
				bridge: [bridge, other],
			},
			knownStablecoinSymbols,
			deuroSymbol
		);
		expect(route.fromSymbol).toBe("dEURO");
		expect(route.toSymbol).toBe("EURC");
		expect(route.bridge).toBe(bridge);
	});

	test("omits the direction when tokenOut is unknown", () => {
		const route = parseSwapQuery({ tokenOut: "DOGE" }, knownStablecoinSymbols, deuroSymbol);
		expect(route.fromSymbol).toBeUndefined();
		expect(route.toSymbol).toBeUndefined();
	});

	test("omits the direction for two stablecoins and keeps a valid bridge", () => {
		const route = parseSwapQuery({ tokenIn: "EURS", tokenOut: "EURC", bridge }, knownStablecoinSymbols, deuroSymbol);
		expect(route.fromSymbol).toBeUndefined();
		expect(route.toSymbol).toBeUndefined();
		expect(route.bridge).toBe(bridge);
	});
});
