import { test, expect } from "@playwright/test";
import { getAddress } from "viem";
import { WHITELISTED_POSITIONS } from "../utils/constant";

// BorrowForm.tsx:86 filters with a case-sensitive includes(); a non-checksummed
// entry never matches, so the collateral picker stays empty. The sort at
// BorrowForm.tsx:108-109 compares case-insensitively via toLowerCase() on both
// sides, so casing cannot change order; a duplicate still can, because findIndex
// returns the first match. Both cases fail silently — no type/lint/runtime error.

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
