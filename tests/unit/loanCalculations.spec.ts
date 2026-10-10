import { test, expect } from "@playwright/test";
import {
	calculateNetBorrowHeadroom,
	getLoanDetailsByCollateralAndLiqPrice,
	getLoanDetailsByCollateralAndStartingLiqPrice,
	getLoanDetailsByCollateralAndYouGetAmount,
} from "../../utils/loanCalculations";
import { calculateOptimalRepayAmount, calculateTimeBuffer } from "../../utils/dynamicRepayCalculations";
import type { PositionQuery } from "@deuro/api";

const position = {
	fixedAnnualRatePPM: 120_000,
	annualInterestPPM: 120_000,
	collateralDecimals: 8,
	reserveContribution: 100_000,
	original: "0x8baA6d891c907E4EBa4b1b0Ef351cB678D50AE7F",
	expiration: Math.floor(Date.now() / 1000) + 365 * 24 * 3600,
} as unknown as PositionQuery;

const zeroDec = { ...position, collateralDecimals: 0 } as unknown as PositionQuery;

test.describe("loan details", () => {
	test("by collateral + liquidation price including zero collateral", () => {
		const d = getLoanDetailsByCollateralAndLiqPrice(position, 1n * 10n ** 8n, 50_000n * 10n ** 18n);
		expect(d.loanAmount).toBeGreaterThan(0n);
		expect(d.amountToSendToWallet).toBeGreaterThan(0n);
		expect(d.originalPosition).toBe(position.original);
		const z = getLoanDetailsByCollateralAndLiqPrice(position, 0n, 50_000n * 10n ** 18n);
		expect(z.startingLiquidationPrice).toBe(0n);
		const zdec = getLoanDetailsByCollateralAndLiqPrice(zeroDec, 1n, 1n);
		expect(zdec.loanAmount).toBeGreaterThanOrEqual(0n);
	});

	test("by starting liquidation price and you-get amount", () => {
		const start = getLoanDetailsByCollateralAndStartingLiqPrice(position, 1n * 10n ** 8n, 40_000n * 10n ** 18n);
		expect(start.loanAmount).toBeGreaterThan(0n);
		expect(start.liquidationPrice).toBeGreaterThan(0n);
		const z = getLoanDetailsByCollateralAndStartingLiqPrice(position, 0n, 40_000n * 10n ** 18n);
		expect(z.liquidationPrice).toBe(0n);
		const you = getLoanDetailsByCollateralAndYouGetAmount(position, 1n * 10n ** 8n, 1_000n * 10n ** 18n);
		expect(you.amountToSendToWallet).toBe(1_000n * 10n ** 18n);
		const youZ = getLoanDetailsByCollateralAndYouGetAmount(position, 0n, 1n);
		expect(youZ.startingLiquidationPrice).toBe(0n);
		const expired = getLoanDetailsByCollateralAndYouGetAmount(
			{ ...position, expiration: 1 } as unknown as PositionQuery,
			1n * 10n ** 8n,
			100n * 10n ** 18n,
			new Date(Date.now() + 60_000),
		);
		expect(expired.loanAmount).toBeGreaterThan(0n);
	});
});

test.describe("headroom + repay buffer", () => {
	test("reuses live-state cases and extra branches", () => {
		const live = {
			collateralBalance: 100_000_000n,
			price: 510_000_000_000_000_000_000_000_000_000_000n,
			principal: 44_494_748_000_000_000_000_000n,
			interest: 1_485_224_500_000_000_000_000n,
			reserveContribution: 100_000n,
			availableForMinting: 1_570_478_740_000_000_000_000_000n,
			collateralDecimals: 8,
		};
		expect(calculateNetBorrowHeadroom(live)).toBeGreaterThan(0n);
		expect(calculateNetBorrowHeadroom({ ...live, reserveContribution: 1_000_000n })).toBe(0n);
		expect(calculateNetBorrowHeadroom({ ...live, collateralDecimals: 0 })).toBeGreaterThanOrEqual(0n);
		expect(calculateTimeBuffer(live.principal, 120_000)).toBeGreaterThan(0n);
		const repay = calculateOptimalRepayAmount({
			userInputAmount: 2_000n * 10n ** 18n,
			currentInterest: 100n * 10n ** 18n,
			walletBalance: 5_000n * 10n ** 18n,
			reserveContribution: 100_000n,
			principal: live.principal,
			fixedAnnualRatePPM: 120_000,
		});
		expect(repay).toBeGreaterThan(100n * 10n ** 18n);
		const interestOnly = calculateOptimalRepayAmount({
			userInputAmount: 10n,
			currentInterest: 100n * 10n ** 18n,
			walletBalance: 50n,
			reserveContribution: 100_000n,
			principal: live.principal,
			fixedAnnualRatePPM: 120_000,
		});
		expect(interestOnly).toBeLessThanOrEqual(50n);
	});
});
