import { test, expect } from "@playwright/test";

/**
 * Currency display tests - verify USD ($) is shown everywhere, not EUR (€)
 * Part of the EUR to USD migration (PR #77)
 */

test.describe("Currency Display - USD Only", () => {
	test.beforeEach(async ({ page }) => {
		await page.waitForLoadState("networkidle");
	});

	const pages = [
		{ url: "/mint", name: "Mint" },
		{ url: "/swap", name: "Swap" },
		{ url: "/equity", name: "Equity" },
		{ url: "/savings", name: "Savings" },
		{ url: "/referrals", name: "Referrals" },
		{ url: "/monitoring", name: "Monitoring" },
		{ url: "/mypositions", name: "My Positions" },
	];

	for (const pageInfo of pages) {
		test(`${pageInfo.name} page should not display EUR symbol (€)`, async ({ page }) => {
			await page.goto(pageInfo.url);
			await page.waitForLoadState("networkidle");

			// Verify no EUR symbols (€) are displayed in visible text
			const euroSymbolCount = await page.locator("text=€").count();
			expect(euroSymbolCount).toBe(0);
		});
	}

	test("Mint page should display USD value for collateral", async ({ page }) => {
		await page.goto("/mint");
		await page.waitForLoadState("networkidle");

		// TokenInput should show $ values (e.g., "$0.00" or "$1,234.56")
		const usdValues = page.locator("text=/\\$\\d/");
		await expect(usdValues.first()).toBeVisible({ timeout: 15000 });
	});

	test("Swap page should display USD values", async ({ page }) => {
		await page.goto("/swap");
		await page.waitForLoadState("networkidle");

		// TokenInput should show $ values
		const usdValues = page.locator("text=/\\$\\d/");
		await expect(usdValues.first()).toBeVisible({ timeout: 15000 });
	});

	test("Referrals page should show $ for bonus amounts", async ({ page }) => {
		await page.goto("/referrals");
		await page.waitForLoadState("networkidle");

		// Stats should show $ prefix for amounts (e.g., "$ 0" or "$ 1,234")
		const dollarAmounts = page.locator("text=/\\$ \\d/");
		await expect(dollarAmounts.first()).toBeVisible({ timeout: 15000 });
	});

	test("Equity page should display USD values", async ({ page }) => {
		await page.goto("/equity");
		await page.waitForLoadState("networkidle");

		// Should show $ values, not € values
		const usdValues = page.locator("text=/\\$\\d/");
		await expect(usdValues.first()).toBeVisible({ timeout: 15000 });
	});

	test("Savings page should not display EUR symbol", async ({ page }) => {
		await page.goto("/savings");
		await page.waitForLoadState("networkidle");

		// Savings page displays amounts in JUSD, not with currency symbols
		// Just verify no EUR symbol is shown
		const euroSymbolCount = await page.locator("text=€").count();
		expect(euroSymbolCount).toBe(0);
	});
});
