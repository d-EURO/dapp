import { test, expect } from '@playwright/test';
import { calculateNetBorrowHeadroom } from '../utils/loanCalculations';
import { calculateTimeBuffer } from '../utils/dynamicRepayCalculations';

// Live mainnet state of position 0x5AFb27c7aAdc3Ad87BdD4A6De7cc9271F80D566F
// (eth_call results at 2026-05-16, see RPC verification)
const liveState = {
	collateralBalance: 100_000_000n,                                  // 1.0 WBTC (8 dec)
	price: 510_000_000_000_000_000_000_000_000_000_000n,              // 5.1e32
	principal: 44_494_748_000_000_000_000_000n,                       // 44 494.748 dEURO
	interest: 1_485_224_500_000_000_000_000n,                         // ~1485.22 dEURO
	reservePPM: 100_000n,                                             // 10 %
	availableForMinting: 1_570_478_740_000_000_000_000_000n,          // 1 570 478.74 dEURO
	collateralDecimals: 8,
};

test.describe('calculateNetBorrowHeadroom', () => {
	test('matches Position._checkCollateral exactly for the live 0x5AFb position', () => {
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
		expect(lhs >= rhs).toBe(true);                                    // _checkCollateral passes
		expect(lhs - rhs).toBeLessThan(2n * BigInt(1e18));                // ≤ 1 dEURO_atom slack (BigInt floor)
	});

	test('returns 0 when collateral value < collateralRequirement (under-water position)', () => {
		const underWater = { ...liveState, principal: 60_000_000_000_000_000_000_000n };  // 60 000 > 51 000 cap
		expect(calculateNetBorrowHeadroom(underWater)).toBe(0n);
	});

	test('is capped by availableForMinting (family-wide limit)', () => {
		const tinyFamilyCap = { ...liveState, availableForMinting: 1_000_000_000_000_000_000n };  // 1 dEURO
		const r = calculateNetBorrowHeadroom(tinyFamilyCap);
		const usablePPM = 1_000_000n - tinyFamilyCap.reservePPM;
		expect(r).toBe((tinyFamilyCap.availableForMinting * usablePPM) / 1_000_000n);  // 0.9 dEURO net
	});

	test('returns 0 when reservePPM == 100 % (no usable headroom)', () => {
		expect(calculateNetBorrowHeadroom({ ...liveState, reservePPM: 1_000_000n })).toBe(0n);
	});

	test('with calculateTimeBuffer projection survives Position._accrueInterest at mint time', () => {
		// Real revert observed (tx 0x3dc68fbf…): mint reverted with InsufficientCollateral
		// because `_accrueInterest()` runs inside `_mint` and the stored interest grew by
		// ~2.66 s of drift between RPC read and TX inclusion. The 10-min projection
		// removes that race entirely.
		const projected = liveState.interest + calculateTimeBuffer(liveState.principal, 120_000);
		const safe = calculateNetBorrowHeadroom({ ...liveState, interest: projected });

		// Replay on-chain check with 2 minutes of additional accrued interest beyond our buffer cushion
		const usablePPM = 1_000_000n - liveState.reservePPM;
		const grossMint = (safe * 1_000_000n) / usablePPM;
		const interest2minLater = liveState.interest +
			(liveState.principal * usablePPM * 120_000n * 120n) / (365n * 86400n * 1_000_000n * 1_000_000n);
		const interestOverhead = (interest2minLater * 1_000_000n + usablePPM - 1n) / usablePPM;
		const newColReq = liveState.principal + grossMint + interestOverhead;
		const lhs = liveState.collateralBalance * liveState.price;
		const rhs = newColReq * BigInt(1e18);
		expect(lhs >= rhs).toBe(true);

		// And the displayed value is still nonzero / near the unbuffered cap
		expect(safe).toBeGreaterThan(4_300n * BigInt(1e18));
		expect(safe).toBeLessThan(4_369n * BigInt(1e18) + BigInt(6e17));   // < 4 369.60
	});

	test('handles 18-dec collateral (decimalsAdjustment = 1e18)', () => {
		const wstEth = {
			collateralBalance: 10n * BigInt(1e18),                        // 10 wstETH
			price: 3_000n * BigInt(1e18),                                 // 3000 dEURO per whole unit (gross)
			principal: 20_000n * BigInt(1e18),                            // 20 000 dEURO
			interest: 0n,
			reservePPM: 100_000n,                                          // 10 %
			availableForMinting: 1_000_000n * BigInt(1e18),                // big
			collateralDecimals: 18,
		};
		// collateralValue = 10 × 3000 = 30 000; grossHeadroom = 30 000 − 20 000 = 10 000; net = 9 000
		expect(calculateNetBorrowHeadroom(wstEth)).toBe(9_000n * BigInt(1e18));
	});
});
