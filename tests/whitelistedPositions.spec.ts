import { test, expect } from "@playwright/test";
import { getAddress } from "viem";
import { WHITELISTED_POSITIONS } from "../utils/constant";

// BorrowForm matches this array with a case-sensitive includes() and uses
// findIndex for display order. A non-checksummed or duplicate entry fails
// silently — empty or mis-ordered collateral picker, no type/lint/runtime error.

test.describe("WHITELISTED_POSITIONS", () => {
	test("each entry is EIP-55 checksummed", () => {
		// BorrowForm.tsx:86: WHITELISTED_POSITIONS.includes(p.position) is
		// case-sensitive and the API returns EIP-55 checksummed addresses.
		for (const entry of WHITELISTED_POSITIONS) {
			const checksummed = getAddress(entry);
			expect(entry, `WHITELISTED_POSITIONS entry "${entry}" is not EIP-55 checksummed; expected "${checksummed}"`).toBe(checksummed);
		}
	});

	test("has no duplicate entries (case-insensitive)", () => {
		const seen = new Map<string, string>();
		for (const entry of WHITELISTED_POSITIONS) {
			const key = entry.toLowerCase();
			const previous = seen.get(key);
			expect(previous, `WHITELISTED_POSITIONS contains duplicate of "${entry}" (already listed as "${previous}")`).toBeUndefined();
			seen.set(key, entry);
		}
	});

	test("is not empty", () => {
		expect(WHITELISTED_POSITIONS.length).toBeGreaterThan(0);
	});
});
