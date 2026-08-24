import { test, expect } from "@playwright/test";
import { expectNoCrash, gotoReady } from "../helpers/app";
import { WHITELISTED } from "../helpers/constants";

test.describe("monitoring", () => {
	test("positions table", async ({ page }) => {
		await gotoReady(page, "/monitoring");
		await expect(page).toHaveTitle(/dEURO/);
		await expectNoCrash(page);
	});

	test("position overview, challenge and force-sell routes", async ({ page }) => {
		for (const path of [
			`/monitoring/${WHITELISTED.wbtc}`,
			`/monitoring/${WHITELISTED.wbtc}/challenge`,
			`/monitoring/${WHITELISTED.wbtc}/forceSell`,
			`/monitoring/${WHITELISTED.weth}`,
		]) {
			await gotoReady(page, path);
			await expectNoCrash(page);
			await expect(page.locator("header")).toBeVisible();
		}
	});
});

test.describe("challenges / auctions", () => {
	test("auctions list", async ({ page }) => {
		await gotoReady(page, "/challenges");
		await expect(page).toHaveTitle(/dEURO/);
		await expectNoCrash(page);
	});

	test("bid route for index 0 still renders the shell", async ({ page }) => {
		const res = await page.goto("/challenges/0/bid");
		expect(res?.status()).toBeLessThan(500);
		await expect(page.locator("header")).toBeVisible();
	});
});

test.describe("my positions", () => {
	test("owned positions, challenges and bids sections", async ({ page }) => {
		await gotoReady(page, "/mypositions");
		await expect(page).toHaveTitle(/dEURO/);
		await expect(page.getByText(/position|challenge|bid/i).first()).toBeVisible();
		await expectNoCrash(page);
	});

	test("adjust route for a known position", async ({ page }) => {
		await gotoReady(page, `/mypositions/${WHITELISTED.wbtc}/adjust`);
		await expectNoCrash(page);
	});
});
