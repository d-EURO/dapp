import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { reducer as account, actions as accountActions, initialState as accountInitial } from "../../redux/slices/account.slice";
import { initialState as positionsInitial } from "../../redux/slices/positions.slice";
import { getLoanDetailsByCollateralAndStartingLiqPrice } from "../../utils/loanCalculations";
import type { PositionQuery } from "@deuro/api";

const root = path.join(__dirname, "../..");

test.describe("known bugs — correct behaviour, expected to fail until fixed", () => {
	test("BUG-1 resetAccountState restores initial state", () => {
		test.fail(true, "BUG-1");
		const loading = account(accountInitial, accountActions.setLoading(true));
		const withError = account(loading, accountActions.hasError("stale"));
		const reset = account(withError, accountActions.resetAccountState());
		expect(reset).toEqual(accountInitial);
	});

	test("BUG-2 startingLiquidationPrice keeps input units", () => {
		test.fail(true, "BUG-2");
		const position = {
			fixedAnnualRatePPM: 120_000,
			annualInterestPPM: 120_000,
			collateralDecimals: 8,
			reserveContribution: 100_000,
			original: "0x8baA6d891c907E4EBa4b1b0Ef351cB678D50AE7F",
			expiration: Math.floor(Date.now() / 1000) + 365 * 24 * 3600,
		} as unknown as PositionQuery;
		const inputPrice = 40_000n * 10n ** 18n;
		const details = getLoanDetailsByCollateralAndStartingLiqPrice(position, 1n * 10n ** 8n, inputPrice);
		expect(details.startingLiquidationPrice).toBe(inputPrice);
	});

	test("BUG-3 LoadingScreen does not named-import version from package.json", () => {
		test.fail(true, "BUG-3");
		const src = fs.readFileSync(path.join(root, "components/LoadingScreen.tsx"), "utf8");
		expect(src).not.toMatch(/import\s*\{\s*version\s*\}\s*from\s*["']\.\.\/package\.json["']/);
	});

	test("BUG-6 positions state uses deniedPositions", () => {
		test.fail(true, "BUG-6");
		expect(positionsInitial).toHaveProperty("deniedPositions");
		expect(positionsInitial).not.toHaveProperty("deniedPositioins");
	});

	test("BUG-7 Navbar does not bind unused isMainet", () => {
		test.fail(true, "BUG-7");
		const src = fs.readFileSync(path.join(root, "components/Navbar/index.tsx"), "utf8");
		expect(src).not.toMatch(/\bisMainet\b/);
	});
});
