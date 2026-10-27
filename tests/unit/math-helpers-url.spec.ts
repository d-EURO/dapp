import { test, expect } from "@playwright/test";
import { abs, min } from "../../utils/math";
import { uniqueValues } from "../../utils/format-array";
import { ContractUrl, TxUrl } from "../../utils/helpers";
import { getCarryOnQueryParams, getPublicViewAddress, toQueryString } from "../../utils/url";
import { BadgeCloneColor, BadgeOriginalColor } from "../../utils/customTheme";
import { getCollateralizationWarningThreshold, MARKETING_PARAM_NAME } from "../../utils/constant";
import { getFrontendCodeFromReferralName, getReferralNameFromFrontendCode } from "../../utils/referrals";
import { buildContractBatcher } from "../../utils/contractBatcher";
import { logApiError } from "../../utils/errorLogger";
import axios from "axios";
import { mainnet } from "viem/chains";

test.describe("math", () => {
	test("abs and min cover both branches", () => {
		expect(abs(5n)).toBe(5n);
		expect(abs(-7n)).toBe(7n);
		expect(min(1n, 2n)).toBe(1n);
		expect(min(9n, 3n)).toBe(3n);
	});
});

test.describe("format-array", () => {
	test("uniqueValues filter", () => {
		expect(["a", "b", "a"].filter(uniqueValues)).toEqual(["a", "b"]);
	});
});

test.describe("helpers", () => {
	test("ContractUrl and TxUrl with and without explorer", () => {
		const hash = ("0x" + "cd".repeat(32)) as `0x${string}`;
		expect(ContractUrl("0xabc", mainnet)).toMatch(/etherscan\.io\/address\/0xabc/);
		expect(TxUrl(hash, mainnet)).toMatch(/\/tx\/0xcd/);
		expect(ContractUrl("0xabc", { blockExplorers: undefined } as never)).toMatch(/etherscan\.io\/address\/0xabc/);
	});
});

test.describe("url", () => {
	test("carry-on query params, publicView, empty query string", () => {
		const router = { query: { ref: "alice", publicView: "0xabc", other: "nope" } } as never;
		expect(getPublicViewAddress(router)).toBe("0xabc");
		expect(getCarryOnQueryParams(router)).toEqual({ [MARKETING_PARAM_NAME]: "alice", publicView: "0xabc" });
		expect(toQueryString({})).toBe("");
		expect(toQueryString({ ref: "alice" })).toBe("?ref=alice");
		expect(getPublicViewAddress({ query: {} } as never)).toBe("");
	});
});

test.describe("constant + theme + referrals", () => {
	test("collateralization warning override and default", () => {
		expect(getCollateralizationWarningThreshold()).toBe(110);
		expect(getCollateralizationWarningThreshold("WFPS")).toBe(105);
		expect(getCollateralizationWarningThreshold("wbtc")).toBe(110);
		expect(BadgeOriginalColor).toMatch(/^#/);
		expect(BadgeCloneColor).toMatch(/^#/);
	});

	test("frontend code round-trip and zero-prefix filter", () => {
		const code = getFrontendCodeFromReferralName("alice");
		expect(code.startsWith("0x")).toBe(true);
		expect(getReferralNameFromFrontendCode(code)).toBe("alice");
		expect(getReferralNameFromFrontendCode("0x11" + "00".repeat(31))).toBe("");
	});
});

test.describe("contractBatcher", () => {
	test("expands multiple calls and parses grouped responses", () => {
		const abi = [] as never;
		const batcher = buildContractBatcher([
			{
				chainId: 1,
				address: "0x1111111111111111111111111111111111111111",
				abi,
				functionName: "balanceOf",
				calls: [
					{ id: "a", args: ["0x1"] },
					{ id: "b", args: ["0x2"] },
				],
			},
			{
				chainId: 1,
				address: "0x2222222222222222222222222222222222222222",
				abi,
				functionName: "totalSupply",
				args: [],
			},
		]);
		const query = batcher.getQuery();
		expect(query).toHaveLength(3);
		expect(query[0].functionName).toBe("balanceOf");
		const parsed = batcher.parseResponse([10n, 20n, 99n]);
		expect(parsed["0x1111111111111111111111111111111111111111"].balanceOf).toEqual({ a: 10n, b: 20n });
		expect(parsed["0x2222222222222222222222222222222222222222"].totalSupply).toBe(99n);
	});
});

test.describe("errorLogger", () => {
	test("covers axios status, timeout, network, fallback and non-axios", () => {
		const spy = test.info().skip;
		const errors: unknown[] = [];
		const orig = console.error;
		console.error = (...args: unknown[]) => {
			errors.push(args[0]);
		};
		try {
			logApiError({ isAxiosError: false }, "x");
			const mk = (over: Record<string, unknown>) => {
				const err = { isAxiosError: true, message: "m", ...over };
				Object.setPrototypeOf(err, new Error().constructor.prototype);
				return err;
			};
			axios.isAxiosError = ((e: unknown) => !!(e as { isAxiosError?: boolean }).isAxiosError) as typeof axios.isAxiosError;
			logApiError({ isAxiosError: true, response: { status: 500 }, message: "s" }, "ecosystem data");
			logApiError({ isAxiosError: true, response: { status: 404 }, message: "c" }, "bids data");
			logApiError({ isAxiosError: true, code: "ECONNABORTED", message: "timeout of 1ms" }, "prices");
			logApiError({ isAxiosError: true, code: "ERR_NETWORK", message: "net" }, "positions");
			logApiError({ isAxiosError: true, message: "other" }, "savings");
			logApiError(new Error("boom"), "unexpected");
			expect(errors.length).toBeGreaterThanOrEqual(6);
		} finally {
			console.error = orig;
			void spy;
		}
	});
});
