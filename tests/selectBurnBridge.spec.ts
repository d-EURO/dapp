import { test, expect } from "@playwright/test";
import { Address } from "viem";
import { selectBurnBridge } from "../utils/selectBurnBridge";

const first: Address = "0x0000000000000000000000000000000000000001";
const second: Address = "0x0000000000000000000000000000000000000002";
const third: Address = "0x0000000000000000000000000000000000000003";

test.describe("selectBurnBridge", () => {
	test("picks the candidate with the higher capacity", () => {
		const selected = selectBurnBridge([
			{ address: first, balance: 29_094n * 10n ** 18n, minted: 29_094n * 10n ** 18n, decimals: 18n },
			{ address: second, balance: 524_924n * 10n ** 18n, minted: 524_924n * 10n ** 18n, decimals: 18n },
		]);
		expect(selected.address).toBe(second);
		expect(selected.capacity).toBe(524_924n * 10n ** 18n);
	});

	test("keeps list order when capacities are equal", () => {
		const selected = selectBurnBridge([
			{ address: first, balance: 100n, minted: 100n, decimals: 18n },
			{ address: second, balance: 100n, minted: 100n, decimals: 18n },
		]);
		expect(selected.address).toBe(first);
		expect(selected.capacity).toBe(100n);
	});

	test("picks the middle candidate when it has the highest capacity", () => {
		const selected = selectBurnBridge([
			{ address: first, balance: 10n, minted: 10n, decimals: 18n },
			{ address: second, balance: 50n, minted: 50n, decimals: 18n },
			{ address: third, balance: 20n, minted: 20n, decimals: 18n },
		]);
		expect(selected.address).toBe(second);
		expect(selected.capacity).toBe(50n);
	});

	test("does not prefer a donated balance over a lower minted", () => {
		const selected = selectBurnBridge([
			{ address: first, balance: 1_000_000n * 10n ** 6n, minted: 29_094n * 10n ** 18n, decimals: 6n },
			{ address: second, balance: 524_924_282_010n, minted: 524_924_281_898_701_949_082_700n, decimals: 6n },
		]);
		expect(selected.address).toBe(second);
		expect(selected.capacity).toBe(524_924_281_898n);
	});

	test("caps capacity at the Stablecoin balance when it is below minted", () => {
		const selected = selectBurnBridge([
			{ address: first, balance: 100n * 10n ** 6n, minted: 1_000n * 10n ** 18n, decimals: 6n },
			{ address: second, balance: 50n * 10n ** 6n, minted: 50n * 10n ** 18n, decimals: 6n },
		]);
		expect(selected.address).toBe(first);
		expect(selected.capacity).toBe(100n * 10n ** 6n);
	});

	test("returns the only candidate with minted-capped capacity at 6 decimals", () => {
		const selected = selectBurnBridge([{ address: first, balance: 1_000n * 10n ** 6n, minted: 100n * 10n ** 18n, decimals: 6n }]);
		expect(selected.address).toBe(first);
		expect(selected.capacity).toBe(100n * 10n ** 6n);
	});

	test("does not downscale minted when decimals are above 18", () => {
		const selected = selectBurnBridge([{ address: first, balance: 500n, minted: 200n, decimals: 19n }]);
		expect(selected.address).toBe(first);
		expect(selected.capacity).toBe(200n);
	});

	test("prefers the given address even when its capacity is lower", () => {
		const selected = selectBurnBridge(
			[
				{ address: first, balance: 0n, minted: 0n, decimals: 18n },
				{ address: second, balance: 50n, minted: 50n, decimals: 18n },
			],
			first
		);
		expect(selected.address).toBe(first);
		expect(selected.capacity).toBe(0n);
	});

	test("matches the preferred address case-insensitively", () => {
		const listed: Address = "0xB4fF7412f08C22d7381885e8BdA9EE9825092fd1";
		const preferred: Address = "0xb4ff7412f08c22d7381885e8bda9ee9825092fd1";
		const selected = selectBurnBridge(
			[
				{ address: second, balance: 80n, minted: 80n, decimals: 18n },
				{ address: listed, balance: 5n, minted: 5n, decimals: 18n },
			],
			preferred
		);
		expect(selected.address).toBe(listed);
		expect(selected.capacity).toBe(5n);
	});

	test("falls back to the highest capacity when the preferred address is not a candidate", () => {
		const selected = selectBurnBridge(
			[
				{ address: first, balance: 10n, minted: 10n, decimals: 18n },
				{ address: second, balance: 40n, minted: 40n, decimals: 18n },
			],
			third
		);
		expect(selected.address).toBe(second);
		expect(selected.capacity).toBe(40n);
	});
});
