import { test, expect } from "@playwright/test";

/**
 * UI tests - run without MetaMask
 * These tests verify basic UI elements are rendered correctly
 */

test.describe("UI Elements", () => {
	test("should display navigation bar", async ({ page }) => {
		await page.goto("/dashboard");

		// Check for navigation elements
		const nav = page.locator('nav, [role="navigation"], header');
		await expect(nav.first()).toBeVisible({ timeout: 10000 });
	});

	test("should display connect wallet button when not connected", async ({ page }) => {
		await page.goto("/dashboard");

		// Look for connect button
		const connectButton = page.getByRole("button", { name: /connect|wallet/i }).first();
		await expect(connectButton).toBeVisible({ timeout: 10000 });
	});

	test("should display logo", async ({ page }) => {
		await page.goto("/dashboard");

		// Check for logo image or text
		const logo = page.locator('img[alt*="logo" i], img[src*="logo" i], [class*="logo" i]').first();
		await expect(logo).toBeVisible({ timeout: 10000 });
	});

	test("should have working navigation links", async ({ page }) => {
		await page.goto("/dashboard");

		// Wait for page to fully load
		await page.waitForLoadState("networkidle");

		// Find navigation links - check multiple possible selectors
		const allLinks = page.locator("a[href]");
		const count = await allLinks.count();

		// App should have at least some links
		expect(count).toBeGreaterThan(0);
	});

	test("should be responsive on mobile viewport", async ({ page }) => {
		// Set mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto("/dashboard");

		// Page should still render
		await expect(page.locator("body")).toBeVisible();
	});

	test("should be responsive on tablet viewport", async ({ page }) => {
		// Set tablet viewport
		await page.setViewportSize({ width: 768, height: 1024 });
		await page.goto("/dashboard");

		// Page should still render
		await expect(page.locator("body")).toBeVisible();
	});
});
