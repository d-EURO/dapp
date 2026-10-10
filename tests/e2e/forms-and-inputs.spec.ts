import { test, expect } from "@playwright/test";
import { expectNoCrash, fillVisibleInput, gotoReady } from "../helpers/app";
import { withWallet } from "../helpers/fixtures";
import { WHITELISTED } from "../helpers/constants";

test.describe("shared form controls", () => {
	test("max button and amount inputs on savings", async ({ page }) => {
		await withWallet(page, "/savings");
		const max = page.getByRole("button", { name: /^max$/i }).first();
		if (await max.isVisible().catch(() => false)) {
			await max.click();
		}
		await fillVisibleInput(page, "123.45");
		await expectNoCrash(page);
	});

	test("details expandable panel on mint", async ({ page }) => {
		await gotoReady(page, "/mint");
		const details = page.getByText(/^details$/i).first();
		if (await details.count()) {
			await details.click();
			await expect(page.getByText(/loan amount|retained reserve|apr|interest/i).first()).toBeVisible();
			await details.click();
		}
		await expectNoCrash(page);
	});

	test("date / slider controls on mint create", async ({ page }) => {
		await gotoReady(page, "/mint/create");
		const inputs = page.locator("input");
		const n = await inputs.count();
		for (let i = 0; i < Math.min(n, 4); i++) {
			const type = await inputs.nth(i).getAttribute("type");
			if (type !== "checkbox" && type !== "radio") {
				await inputs.nth(i).fill("1").catch(() => undefined);
			}
		}
		await expectNoCrash(page);
	});

	test("plus/minus buttons if present on mint", async ({ page }) => {
		await gotoReady(page, "/mint");
		const plus = page.locator("button").filter({ hasText: "+" }).first();
		if (await plus.count()) await plus.click();
		await expectNoCrash(page);
	});

	test("challenge form fields on monitoring challenge", async ({ page }) => {
		await gotoReady(page, `/monitoring/${WHITELISTED.wbtc}/challenge`);
		const connect = page.getByRole("button", { name: /connect wallet|challenge|approve/i }).first();
		await expect(connect).toBeVisible();
		await expectNoCrash(page);
	});

	test("force-sell form fields", async ({ page }) => {
		await gotoReady(page, `/monitoring/${WHITELISTED.wbtc}/forceSell`);
		await expect(page.getByRole("button", { name: /connect wallet|bid|sell|approve/i }).first()).toBeVisible();
		await expectNoCrash(page);
	});
});
