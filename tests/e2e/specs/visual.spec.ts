import { test, expect } from "@playwright/test";

/**
 * Visual regression tests - capture and compare page screenshots
 * Run `yarn test:e2e:update-snapshots` to update baseline images
 */

test.describe("Visual Regression", () => {
	test.beforeEach(async ({ page }) => {
		// Wait for fonts and assets to load
		await page.waitForLoadState("networkidle");
	});

	test("dashboard page", async ({ page }) => {
		await page.goto("/dashboard");
		await page.waitForLoadState("networkidle");

		// Hide dynamic elements that change between runs
		await hideDynamicElements(page);

		await expect(page).toHaveScreenshot("dashboard.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("mint page", async ({ page }) => {
		await page.goto("/mint");
		await page.waitForLoadState("networkidle");

		await hideDynamicElements(page);

		await expect(page).toHaveScreenshot("mint.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("savings page", async ({ page }) => {
		await page.goto("/savings");
		await page.waitForLoadState("networkidle");

		await hideDynamicElements(page);

		await expect(page).toHaveScreenshot("savings.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("equity page", async ({ page }) => {
		await page.goto("/equity");
		await page.waitForLoadState("networkidle");

		await hideDynamicElements(page);

		await expect(page).toHaveScreenshot("equity.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("governance page", async ({ page }) => {
		await page.goto("/governance");
		await page.waitForLoadState("networkidle");

		await hideDynamicElements(page);

		await expect(page).toHaveScreenshot("governance.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("challenges page", async ({ page }) => {
		await page.goto("/challenges");
		await page.waitForLoadState("networkidle");

		await hideDynamicElements(page);

		await expect(page).toHaveScreenshot("challenges.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("swap page", async ({ page }) => {
		await page.goto("/swap");
		await page.waitForLoadState("networkidle");

		await hideDynamicElements(page);

		await expect(page).toHaveScreenshot("swap.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("referrals page", async ({ page }) => {
		await page.goto("/referrals");
		await page.waitForLoadState("networkidle");

		await hideDynamicElements(page);

		await expect(page).toHaveScreenshot("referrals.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("mobile viewport - dashboard", async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto("/dashboard");
		await page.waitForLoadState("networkidle");

		await hideDynamicElements(page);

		await expect(page).toHaveScreenshot("dashboard-mobile.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("tablet viewport - dashboard", async ({ page }) => {
		await page.setViewportSize({ width: 768, height: 1024 });
		await page.goto("/dashboard");
		await page.waitForLoadState("networkidle");

		await hideDynamicElements(page);

		await expect(page).toHaveScreenshot("dashboard-tablet.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});
});

/**
 * Hide elements that change dynamically between test runs
 * (timestamps, prices, block numbers, etc.)
 */
async function hideDynamicElements(page: import("@playwright/test").Page) {
	await page.evaluate(() => {
		// Hide elements with dynamic content
		const selectors = [
			'[data-testid="block-number"]',
			'[data-testid="timestamp"]',
			'[data-testid="price"]',
			'[class*="loading"]',
			'[class*="spinner"]',
			// Add more selectors as needed for dynamic content
		];

		selectors.forEach((selector) => {
			document.querySelectorAll(selector).forEach((el) => {
				(el as HTMLElement).style.visibility = "hidden";
			});
		});
	});

	// Wait a bit for any animations to settle
	await page.waitForTimeout(500);
}
