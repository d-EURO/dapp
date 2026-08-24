import { test, expect } from "@playwright/test";
import { expectNoCrash, gotoReady, openExpertMode } from "../helpers/app";

test.describe("coverage", () => {
	test("summary, collateral positions and bridges", async ({ page }) => {
		await gotoReady(page, "/coverage");
		await expect(page).toHaveTitle(/dEURO/);
		await expect(page.getByText("Coverage").first()).toBeVisible();
		await expect(page.getByText("Total Supply")).toBeVisible();
		await expect(page.getByText("Collateral Positions").first()).toBeVisible();
		await expect(page.getByText("Stablecoin Bridges").first()).toBeVisible();
		await expect(page.getByText("Reserves").first()).toBeVisible();
		await expect(page.getByText("Other (Fees/Interest)")).toBeVisible();
		await expect(page.locator("text=< 0.01")).toHaveCount(0);
		await expectNoCrash(page);
	});
});

test.describe("governance", () => {
	test("leadrate, minters, voters, positions tables", async ({ page }) => {
		await gotoReady(page, "/governance");
		await expect(page).toHaveTitle(/dEURO/);
		await expect(page.getByText(/governance|leadrate|base rate|minter|voter|position/i).first()).toBeVisible();
		await expectNoCrash(page);
	});

	test("actions stay behind connect-wallet until connected", async ({ page }) => {
		await gotoReady(page, "/governance");
		await expect(page.getByRole("button", { name: /connect wallet/i }).first()).toBeVisible();
	});
});

test.describe("rates", () => {
	test("rates summary renders", async ({ page }) => {
		await gotoReady(page, "/rates");
		await expect(page).toHaveTitle(/dEURO/);
		await expectNoCrash(page);
	});
});

test.describe("ecosystem + minter-check", () => {
	test("ecosystem overview", async ({ page }) => {
		await gotoReady(page, "/ecosystem");
		await expect(page).toHaveTitle(/dEURO/);
		await expectNoCrash(page);
	});

	test("minter-check drill-down page", async ({ page }) => {
		await gotoReady(page, "/minter-check");
		await expect(page).toHaveTitle(/dEURO/);
		await expectNoCrash(page);
	});
});

test.describe("expert mode persistence", () => {
	test("toggling expert mode on dashboard survives reload", async ({ page }) => {
		await gotoReady(page, "/dashboard");
		await openExpertMode(page);
		await page.reload();
		await gotoReady(page, "/dashboard");
		await expect(page.locator("body")).toContainText(/Governance|Expert Mode/);
	});
});
