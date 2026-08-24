import { test, expect } from "@playwright/test";
import { expectNoCrash, gotoReady, waitForApp } from "../helpers/app";
import { ROUTES } from "../helpers/constants";

test.describe("app shell and navigation", () => {
	test("root redirects to dashboard", async ({ page }) => {
		await page.goto("/");
		await waitForApp(page);
		await expect(page).toHaveURL(/\/dashboard/);
		await expect(page).toHaveTitle(/dEURO/);
	});

	test("header, footer and connect wallet are present on dashboard", async ({ page }) => {
		await gotoReady(page, "/dashboard");
		await expectNoCrash(page);
		await expect(page.locator("header")).toBeVisible();
		await expect(page.getByRole("button", { name: /connect wallet/i }).first()).toBeVisible();
		await expect(page.locator("footer")).toBeVisible();
		await expect(page.locator("footer a[aria-label='Documentation']")).toHaveAttribute("href", /docs\.deuro\.com/);
		await expect(page.locator("footer a[aria-label='GitHub']")).toHaveAttribute("href", /github\.com\/d-EURO/);
		await expect(page.locator("footer a[aria-label='Forum']")).toHaveAttribute("href", /github\.com/);
		await expect(page.locator("footer a[aria-label='Telegram community']")).toHaveAttribute("href", /t\.me/);
		await expect(page.locator("footer a[aria-label='X (Twitter)']")).toHaveAttribute("href", /x\.com/);
	});

	test("primary nav reaches each product page", async ({ page }) => {
		await gotoReady(page, "/dashboard");
		for (const label of ["Dashboard", "Swap", "Lending", "Savings", "Equity"]) {
			const nav = page.locator("header ul").getByText(label, { exact: true }).first();
			await expect(nav).toBeVisible();
			await nav.click();
			await waitForApp(page);
			await expectNoCrash(page);
			await expect(page).toHaveTitle(/dEURO/);
		}
	});

	test("referrals nav from wallet cluster", async ({ page }) => {
		await gotoReady(page, "/dashboard");
		await page.getByRole("link", { name: "My Referrals" }).click();
		await waitForApp(page);
		await expect(page).toHaveURL(/\/referrals/);
	});

	test("every static route returns a rendered shell", async ({ page }) => {
		for (const route of ROUTES) {
			await gotoReady(page, route);
			await expectNoCrash(page);
			await expect(page.locator("header")).toBeVisible();
		}
	});

	test("404 page copy and telegram link", async ({ page }) => {
		const res = await page.goto("/this-route-does-not-exist-e2e");
		expect(res?.status()).toBe(404);
		await expect(page.getByText("You seem to be in the wrong place")).toBeVisible();
		await expect(page.getByText("Ping us on Telegram if you think this is a bug")).toBeVisible();
	});
});
