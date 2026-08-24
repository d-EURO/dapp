import { test, expect } from "@playwright/test";
import { expectNoCrash, fillVisibleInput, gotoReady, openExpertMode } from "../helpers/app";
import { WHITELISTED } from "../helpers/constants";
import { withWallet } from "../helpers/fixtures";

test.describe("lending / mint", () => {
	test("borrow form and collateral picker render", async ({ page }) => {
		await gotoReady(page, "/mint");
		await expect(page).toHaveTitle(/dEURO/);
		await expect(page.getByText(/lend|collateral|you get/i).first()).toBeVisible();
		await expectNoCrash(page);
	});

	test("select collateral modal", async ({ page }) => {
		await gotoReady(page, "/mint");
		const trigger = page.getByText(/select your collateral|select collateral|WBTC|WETH|cbBTC/i).first();
		await trigger.click();
		await expect(page.getByText(/WBTC|WETH|BTC|ETH/i).first()).toBeVisible();
		await page.keyboard.press("Escape");
	});

	test("clone page for a whitelisted position", async ({ page }) => {
		await gotoReady(page, `/mint/${WHITELISTED.wbtc}`);
		await expectNoCrash(page);
		await expect(page.locator("header")).toBeVisible();
	});

	test("manage position tabs", async ({ page }) => {
		await gotoReady(page, `/mint/${WHITELISTED.wbtc}/manage`);
		await expectNoCrash(page);
		for (const tab of ["borrow", "collateral", "price", "expiration"]) {
			const url = `/mint/${WHITELISTED.wbtc}/manage/${tab}`;
			await gotoReady(page, url);
			await expectNoCrash(page);
		}
	});

	test("propose new position form", async ({ page }) => {
		await gotoReady(page, "/mint/create");
		await expect(page).toHaveTitle(/dEURO/);
		await expect(page.getByText(/propose|collateral token|initialization/i).first()).toBeVisible();
		await expect(page.getByRole("button", { name: /connect wallet/i }).first()).toBeVisible();
		await expectNoCrash(page);
	});

	test("connected wallet shows confirm/approve on borrow form", async ({ page }) => {
		await withWallet(page, "/mint");
		await fillVisibleInput(page, "1");
		await expect(page.getByRole("button", { name: /connect wallet|approve|lend|confirm|receive/i }).first()).toBeVisible();
		await expectNoCrash(page);
	});

	test("expert mode on dashboard then back to mint still works", async ({ page }) => {
		await gotoReady(page, "/dashboard");
		await openExpertMode(page);
		await gotoReady(page, "/mint");
		await expectNoCrash(page);
	});
});
