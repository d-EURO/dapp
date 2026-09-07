import { test, expect } from "@playwright/test";
import { Address } from "viem";
import { selectBurnBridge } from "../utils/selectBurnBridge";

const first: Address = "0x0000000000000000000000000000000000000001";
const second: Address = "0x0000000000000000000000000000000000000002";

test.describe("selectBurnBridge", () => {
	test("picks the candidate with the higher Stablecoin balance", () => {
		const selected = selectBurnBridge([
			{ address: first, balance: 29_094n * BigInt(1e18) },
			{ address: second, balance: 524_924n * BigInt(1e18) },
		]);
		expect(selected.address).toBe(second);
		expect(selected.balance).toBe(524_924n * BigInt(1e18));
	});

	test("keeps list order when balances are equal", () => {
		const selected = selectBurnBridge([
			{ address: first, balance: 100n },
			{ address: second, balance: 100n },
		]);
		expect(selected.address).toBe(first);
	});

	test("returns the only candidate", () => {
		const selected = selectBurnBridge([{ address: first, balance: 1n }]);
		expect(selected.address).toBe(first);
		expect(selected.balance).toBe(1n);
	});
});
