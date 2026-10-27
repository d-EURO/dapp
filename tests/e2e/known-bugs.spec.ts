import { test, expect } from "@playwright/test";
import { gotoReady } from "../helpers/app";

test.describe("known bugs — correct behaviour, expected to fail until fixed", () => {
	test("BUG-4 404 logo points at an existing asset", async ({ page }) => {
		test.fail(true, "BUG-4");
		await page.goto("/this-route-does-not-exist-e2e");
		const img = page.locator('img[alt="logo"]');
		await expect(img).toBeVisible();
		const src = await img.getAttribute("src");
		expect(src).toBe("/assets/dEuro-Logo.svg");
		const asset = await page.request.get("/assets/dEuro-Logo.svg");
		expect(asset.status()).toBe(200);
	});

	test("BUG-5 savings footer docs link is not a placeholder", async ({ page }) => {
		test.fail(true, "BUG-5");
		await gotoReady(page, "/savings");
		const docs = page.locator("footer a[aria-label='Documentation']");
		await expect(docs).toBeVisible();
		const href = await docs.getAttribute("href");
		expect(href).toBeTruthy();
		expect(href).not.toContain("savings-todo");
		expect(href).toMatch(/docs\.deuro\.com/);
	});
});
