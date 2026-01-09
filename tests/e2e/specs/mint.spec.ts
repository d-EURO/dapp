import { test, expect } from "@playwright/test";

/**
 * Functional tests for the Mint page
 * Tests UI elements, form interactions, and validation
 */

test.describe("Mint Page", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/mint");
		await page.waitForLoadState("networkidle");
	});

	test.describe("Page Layout", () => {
		test("should display mint page title", async ({ page }) => {
			// Title is "Lend JUSD against your Asset"
			const title = page.getByText(/Lend.*JUSD.*Asset/i);
			await expect(title).toBeVisible({ timeout: 15000 });
		});

		test("should display main form card", async ({ page }) => {
			// The form is wrapped in an AppCard
			const formCard = page.locator('[class*="AppCard"], [class*="card"]').first();
			await expect(formCard).toBeVisible({ timeout: 15000 });
		});

		test("should display collateral input section", async ({ page }) => {
			// Look for "Select your collateral asset"
			const collateralSection = page.getByText(/Select your collateral asset/i);
			await expect(collateralSection).toBeVisible({ timeout: 15000 });
		});

		test("should display liquidation price section", async ({ page }) => {
			// Look for "Select your liquidation price"
			const liqPriceSection = page.getByText(/Select your liquidation price/i);
			await expect(liqPriceSection).toBeVisible({ timeout: 15000 });
		});

		test("should display expiration date section", async ({ page }) => {
			// Look for "Set expiration date"
			const expirationSection = page.getByText(/Set expiration date/i);
			await expect(expirationSection).toBeVisible({ timeout: 15000 });
		});

		test("should display 'You get' output section", async ({ page }) => {
			// Look for "You get"
			const youGetSection = page.getByText(/You get/i);
			await expect(youGetSection).toBeVisible({ timeout: 15000 });
		});
	});

	test.describe("Form Elements", () => {
		test("should display collateral amount with cBTC", async ({ page }) => {
			// The collateral shows "cBTC"
			const collateralToken = page.getByText("cBTC").first();
			await expect(collateralToken).toBeVisible({ timeout: 15000 });
		});

		test("should display MAX button for collateral", async ({ page }) => {
			// MAX button in collateral section
			const maxButton = page.getByText("MAX").first();
			await expect(maxButton).toBeVisible({ timeout: 15000 });
		});

		test("should display liquidation price slider", async ({ page }) => {
			// Slider shows MIN and MAX labels
			const minLabel = page.getByText("MIN");
			const maxLabel = page.locator("text=MAX").nth(1); // Second MAX is for slider
			await expect(minLabel).toBeVisible({ timeout: 15000 });
			await expect(maxLabel).toBeVisible({ timeout: 15000 });
		});

		test("should display expiration date picker", async ({ page }) => {
			// Date picker section exists with "Set expiration date" label
			const expirationLabel = page.getByText(/Set expiration date/i);
			await expect(expirationLabel).toBeVisible({ timeout: 15000 });
		});
	});

	test.describe("Header Elements", () => {
		test("should display Connect Wallet button", async ({ page }) => {
			const connectButton = page.getByRole("button", { name: /Connect Wallet/i });
			await expect(connectButton).toBeVisible({ timeout: 15000 });
		});

		test("should display navigation tabs", async ({ page }) => {
			// Check for nav links in header
			const dashboardNav = page.getByRole("link", { name: "Dashboard" });
			await expect(dashboardNav).toBeVisible({ timeout: 15000 });
		});

		test("should display logo", async ({ page }) => {
			// Logo contains JuiceDollar image/text
			const logo = page.locator('header img, header [class*="logo"], a[href="/"]').first();
			await expect(logo).toBeVisible({ timeout: 15000 });
		});
	});

	test.describe("USD Values", () => {
		test("should display USD value for collateral", async ({ page }) => {
			// Shows "$0.00" or similar USD value
			const usdValue = page.locator("text=/\\$\\d/").first();
			await expect(usdValue).toBeVisible({ timeout: 15000 });
		});
	});

	test.describe("Responsive Design", () => {
		test("should be usable on mobile viewport", async ({ page }) => {
			await page.setViewportSize({ width: 375, height: 667 });
			await page.reload();
			await page.waitForLoadState("networkidle");

			// Main title should still be visible
			const title = page.getByText(/Lend.*JUSD/i);
			await expect(title).toBeVisible({ timeout: 15000 });

			// Collateral section should be accessible
			const collateralSection = page.getByText(/collateral/i).first();
			await expect(collateralSection).toBeVisible();
		});

		test("should be usable on tablet viewport", async ({ page }) => {
			await page.setViewportSize({ width: 768, height: 1024 });
			await page.reload();
			await page.waitForLoadState("networkidle");

			// Main form should still be visible
			const title = page.getByText(/Lend.*JUSD/i);
			await expect(title).toBeVisible({ timeout: 15000 });
		});
	});
});
