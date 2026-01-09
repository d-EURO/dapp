import { test, expect } from "@playwright/test";

/**
 * Navigation tests - run without MetaMask
 * These tests verify basic page routing works correctly
 */

test.describe("Navigation", () => {
	test("should load home page and redirect to dashboard", async ({ page }) => {
		await page.goto("/");

		// Home page redirects to dashboard
		await expect(page).toHaveURL(/dashboard/);
	});

	test("should navigate to mint page", async ({ page }) => {
		await page.goto("/mint");

		await expect(page).toHaveURL(/mint/);
		await expect(page.locator("body")).toBeVisible();
	});

	test("should navigate to savings page", async ({ page }) => {
		await page.goto("/savings");

		await expect(page).toHaveURL(/savings/);
		await expect(page.locator("body")).toBeVisible();
	});

	test("should navigate to equity page", async ({ page }) => {
		await page.goto("/equity");

		await expect(page).toHaveURL(/equity/);
		await expect(page.locator("body")).toBeVisible();
	});

	test("should navigate to governance page", async ({ page }) => {
		await page.goto("/governance");

		await expect(page).toHaveURL(/governance/);
		await expect(page.locator("body")).toBeVisible();
	});

	test("should navigate to challenges page", async ({ page }) => {
		await page.goto("/challenges");

		await expect(page).toHaveURL(/challenges/);
		await expect(page.locator("body")).toBeVisible();
	});

	test("should navigate to swap page", async ({ page }) => {
		await page.goto("/swap");

		await expect(page).toHaveURL(/swap/);
		await expect(page.locator("body")).toBeVisible();
	});

	test("should navigate to referrals page", async ({ page }) => {
		await page.goto("/referrals");

		await expect(page).toHaveURL(/referrals/);
		await expect(page.locator("body")).toBeVisible();
	});

	test("should handle invalid routes", async ({ page }) => {
		const response = await page.goto("/invalid-page-that-does-not-exist");

		// Either shows 404 page or redirects - both are valid behaviors
		const is404 = response?.status() === 404;
		const hasRedirected = page.url().includes("dashboard") || page.url().includes("404");
		const has404Content = await page
			.locator("text=/404|not found/i")
			.isVisible()
			.catch(() => false);

		expect(is404 || hasRedirected || has404Content).toBeTruthy();
	});
});
