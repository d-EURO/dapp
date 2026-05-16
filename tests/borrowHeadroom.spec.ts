import { test, expect } from "@playwright/test";
import { calculateNetBorrowHeadroom } from "../utils/loanCalculations";
import { calculateTimeBuffer } from "../utils/dynamicRepayCalculations";

// Live mainnet state of position 0x5AFb27c7aAdc3Ad87BdD4A6De7cc9271F80D566F
// (eth_call results at 2026-05-16, see RPC verification)
const liveState = {
	collateralBalance: 100_000_000n, // 1.0 WBTC (8 dec)
	price: 510_000_000_000_000_000_000_000_000_000_000n, // 5.1e32
	principal: 44_494_748_000_000_000_000_000n, // 44 494.748 dEURO
	interest: 1_485_224_500_000_000_000_000n, // ~1485.22 dEURO
	reservePPM: 100_000n, // 10 %
	availableForMinting: 1_570_478_740_000_000_000_000_000n, // 1 570 478.74 dEURO
	collateralDecimals: 8,
};

test.describe("calculateNetBorrowHeadroom", () => {
	test("matches Position._checkCollateral exactly for the live 0x5AFb position", () => {
		const headroom = calculateNetBorrowHeadroom(liveState);
		// Expected ≈ 4 369.5023 dEURO net (BigInt floor on the final × usablePPM / 1e6 step).
		// Rendered to the user as "4 369.50 dEURO" — was stuck at 0 before the fix.
		expect(headroom).toBe(4_369_502_299_999_999_999_999n);
		expect(headroom / BigInt(1e16)).toBe(436_950n);

		// Cross-check: minting the gross equivalent must satisfy on-chain _checkCollateral
		const usablePPM = 1_000_000n - liveState.reservePPM;
		const grossMint = (headroom * 1_000_000n) / usablePPM;
		const interestOverhead = (liveState.interest * 1_000_000n + usablePPM - 1n) / usablePPM;
		const newColReq = liveState.principal + grossMint + interestOverhead;
		const lhs = liveState.collateralBalance * liveState.price;
		const rhs = newColReq * BigInt(1e18);
		expect(lhs >= rhs).toBe(true); // _checkCollateral passes
		expect(lhs - rhs).toBeLessThan(2n * BigInt(1e18)); // ≤ 1 dEURO_atom slack (BigInt floor)
	});

	test("returns 0 when collateral value < collateralRequirement (under-water position)", () => {
		const underWater = { ...liveState, principal: 60_000_000_000_000_000_000_000n }; // 60 000 > 51 000 cap
		expect(calculateNetBorrowHeadroom(underWater)).toBe(0n);
	});

	test("is capped by availableForMinting (family-wide limit)", () => {
		const tinyFamilyCap = { ...liveState, availableForMinting: 1_000_000_000_000_000_000n }; // 1 dEURO
		const r = calculateNetBorrowHeadroom(tinyFamilyCap);
		const usablePPM = 1_000_000n - tinyFamilyCap.reservePPM;
		expect(r).toBe((tinyFamilyCap.availableForMinting * usablePPM) / 1_000_000n); // 0.9 dEURO net
	});

	test("returns 0 when reservePPM == 100 % (no usable headroom)", () => {
		expect(calculateNetBorrowHeadroom({ ...liveState, reservePPM: 1_000_000n })).toBe(0n);
	});

	test("component-level subtract pattern (raw − calculateTimeBuffer) survives _accrueInterest", () => {
		// Mirrors BorrowedManageSection: rawNetHeadroom = pure formula, then
		// safe = raw > buffer ? raw − buffer : 0  (same shape as the repay branch).
		// Real revert observed in mainnet tx 0x3dc68fbf…: only ~2.66 s of additional
		// interest accrual blew the budget. The 10-min buffer removes that race.
		const raw = calculateNetBorrowHeadroom(liveState);
		const buffer = calculateTimeBuffer(liveState.principal, 120_000);
		const safe = raw > buffer ? raw - buffer : 0n;

		// Replay on-chain check at TX-time with 2 minutes of additional interest
		// (well inside the 10-min cushion).
		const usablePPM = 1_000_000n - liveState.reservePPM;
		const grossMint = (safe * 1_000_000n) / usablePPM;
		const interest2minLater =
			liveState.interest + (liveState.principal * usablePPM * 120_000n * 120n) / (365n * 86400n * 1_000_000n * 1_000_000n);
		const interestOverhead = (interest2minLater * 1_000_000n + usablePPM - 1n) / usablePPM;
		const newColReq = liveState.principal + grossMint + interestOverhead;
		const lhs = liveState.collateralBalance * liveState.price;
		const rhs = newColReq * BigInt(1e18);
		expect(lhs >= rhs).toBe(true);

		// Sanity: the buffer should cost roughly 1 × calculateTimeBuffer net.
		expect(raw - safe).toBe(buffer);
		expect(safe).toBeGreaterThan(4_369n * BigInt(1e18)); // > 4 369.00
		expect(safe).toBeLessThan(4_369n * BigInt(1e18) + BigInt(5e17)); // < 4 369.50
	});

	test("handles 18-dec collateral (decimalsAdjustment = 1e18)", () => {
		const wstEth = {
			collateralBalance: 10n * BigInt(1e18), // 10 wstETH
			price: 3_000n * BigInt(1e18), // 3000 dEURO per whole unit (gross)
			principal: 20_000n * BigInt(1e18), // 20 000 dEURO
			interest: 0n,
			reservePPM: 100_000n, // 10 %
			availableForMinting: 1_000_000n * BigInt(1e18), // big
			collateralDecimals: 18,
		};
		// collateralValue = 10 × 3000 = 30 000; grossHeadroom = 30 000 − 20 000 = 10 000; net = 9 000
		expect(calculateNetBorrowHeadroom(wstEth)).toBe(9_000n * BigInt(1e18));
	});
});

test.describe("BorrowedManageSection validation race", () => {
	test("user input set from max-button stays valid while raw cap drifts within the buffer", () => {
		// At t0 the max button writes (rawNet − buffer) into the input.
		// Validation compares against rawNet (not the buffered max), so drift inside
		// the buffer window must NOT mark the input invalid.
		const rawNetT0 = calculateNetBorrowHeadroom(liveState);
		const buffer = calculateTimeBuffer(liveState.principal, 120_000);
		const maxButtonValue = rawNetT0 > buffer ? rawNetT0 - buffer : 0n;
		const amount = maxButtonValue;

		// Simulate the page idling for 5 minutes — half the 10-min buffer window.
		const usablePPM = 1_000_000n - liveState.reservePPM;
		const driftSeconds = 300n;
		const driftedInterest =
			liveState.interest + (liveState.principal * usablePPM * 120_000n * driftSeconds) / (365n * 86400n * 1_000_000n * 1_000_000n);
		const rawNetT1 = calculateNetBorrowHeadroom({ ...liveState, interest: driftedInterest });

		expect(amount).toBeLessThanOrEqual(rawNetT1); // validation: amount > rawNet ? error : ok
		expect(rawNetT1).toBeLessThan(rawNetT0); // sanity: cap really did drift down
	});
});
