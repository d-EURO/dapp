import { test, expect } from "@playwright/test";
import {
	FormatType,
	decodeBigIntCall,
	decodeStringCall,
	formatBigInt,
	formatCurrency,
	formatDate,
	formatDateDuration,
	formatDateLocale,
	formatDuration,
	formatNumber,
	isDateExpired,
	isDateUpcoming,
	shortenAddress,
	shortenHash,
	shortenString,
	toDate,
	toTimestamp,
	transactionLink,
} from "../../utils/format";

test.describe("formatCurrency", () => {
	test("formats US amounts and the < 0.01 dust path", () => {
		expect(formatCurrency(1234.5, 0, 2)).toBe("1,234.5");
		expect(formatCurrency("99.1", 2, 2)).toBe("99.10");
		expect(formatCurrency(0.001, 0, 2)).toBe("< 0.01");
		expect(formatCurrency(NaN)).toBeNull();
	});

	test("tiny format uses narrow spaces and drops decimals above 1000", () => {
		expect(formatCurrency(12.3, 0, 2, FormatType.tiny)).toMatch(/12/);
		expect(formatCurrency(1500, 0, 2, FormatType.tiny)).not.toMatch(/\./);
	});
});

test.describe("formatNumber / formatBigInt", () => {
	test("pads missing decimals and groups thousands", () => {
		expect(formatNumber("1234")).toBe("1,234.00");
		expect(formatNumber("1234.5")).toBe("1,234.50");
	});

	test("zero bigint and dust below display precision", () => {
		expect(formatBigInt()).toBe("0.00");
		expect(formatBigInt(0n)).toBe("0.00");
		expect(formatBigInt(1n, 18, 2)).toMatch(/^< /);
		expect(formatBigInt(123n * 10n ** 16n, 18, 0)).toMatch(/^1/);
	});
});

test.describe("address and hash helpers", () => {
	test("shortenString / shortenAddress / shortenHash / transactionLink", () => {
		expect(shortenString("abcdefghijklmnop")).toBe("abcdef...mnop");
		expect(shortenAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")).toMatch(/^0xf39F\.\.\.2266$/);
		expect(() => shortenAddress("not-an-address" as `0x${string}`)).toThrow(/Invalid input/);
		const hash = ("0x" + "ab".repeat(32)) as `0x${string}`;
		expect(shortenHash(hash)).toMatch(/^0xabab/);
		expect(transactionLink("https://etherscan.io", hash)).toBe(`https://etherscan.io/tx/${hash}`);
	});
});

test.describe("dates", () => {
	test("toTimestamp / toDate round-trip", () => {
		const d = new Date("2020-01-02T00:00:00Z");
		expect(toTimestamp(d)).toBe(Math.floor(d.getTime() / 1000));
		expect(toDate(1_577_923_200n).toISOString()).toBe("2020-01-02T00:00:00.000Z");
		expect(toDate(1_577_923_200).toISOString()).toBe("2020-01-02T00:00:00.000Z");
	});

	test("formatDate* and duration helpers", () => {
		expect(formatDate(1_577_923_200)).toMatch(/2020-01-02/);
		expect(formatDateLocale(1_577_923_200)).toMatch(/20200102/);
		expect(formatDuration(0)).toBe("--");
		expect(formatDuration(3600)).not.toBe("--");
		expect(formatDateDuration(1_577_923_200)).toBeTruthy();
		expect(isDateExpired(1_000)).toBe(true);
		expect(isDateUpcoming(4_000_000_000)).toBe(true);
	});
});

test.describe("decode helpers", () => {
	test("decodeBigIntCall / decodeStringCall handle error and success", () => {
		expect(decodeBigIntCall({ error: true })).toBe(0n);
		expect(decodeBigIntCall({ result: undefined })).toBe(0n);
		expect(decodeBigIntCall({ result: "12" })).toBe(12n);
		expect(decodeStringCall({ error: true })).toBe("");
		expect(decodeStringCall({ result: "ok" })).toBe("ok");
	});
});
