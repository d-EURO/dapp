import { test, expect } from "@playwright/test";

test.describe("Coverage Page", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/coverage");
	});

	test("page loads with HTTP 200", async ({ page }) => {
		const response = await page.goto("/coverage");
		expect(response?.status()).toBe(200);
	});

	test("page has correct title", async ({ page }) => {
		await expect(page).toHaveTitle(/dEURO/);
	});

	test("SSR renders coverage section titles", async ({ page }) => {
		// These are rendered server-side and should always be visible
		await expect(page.locator("text=Coverage").first()).toBeVisible();
		await expect(page.locator("text=Total Supply")).toBeVisible();
		await expect(page.locator("text=Collateral Positions").first()).toBeVisible();
		await expect(page.locator("text=Stablecoin Bridges").first()).toBeVisible();
	});

	test("SSR renders summary legend labels", async ({ page }) => {
		await expect(page.locator("text=Reserves").first()).toBeVisible();
		await expect(page.locator("text=Other (Fees/Interest)")).toBeVisible();
	});

	test("SSR renders bridges table headers", async ({ page }) => {
		await expect(page.locator("text=Stablecoin").first()).toBeVisible();
		await expect(page.locator("text=Minted").first()).toBeVisible();
		await expect(page.locator("text=Limit").first()).toBeVisible();
		await expect(page.locator("text=Utilization").first()).toBeVisible();
		await expect(page.locator("text=Status").first()).toBeVisible();
	});

	test("page contains dEURO symbol", async ({ page }) => {
		await expect(page.locator("text=dEURO").first()).toBeVisible();
	});

	test("no < 0.01 values appear on page", async ({ page }) => {
		await page.waitForTimeout(3000);
		const lessThan = page.locator("text=< 0.01");
		await expect(lessThan).toHaveCount(0);
	});
});
