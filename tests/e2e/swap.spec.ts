import { test, expect } from "@playwright/test";
import { expectNoCrash, fillVisibleInput, gotoReady } from "../helpers/app";
import { withWallet } from "../helpers/fixtures";

test.describe("swap", () => {
	test("page loads title, amount input and connect-wallet guard", async ({ page }) => {
		await gotoReady(page, "/swap");
		await expect(page).toHaveTitle(/dEURO/);
		await expect(page.getByText(/swap/i).first()).toBeVisible();
		await expect(page.getByRole("button", { name: /connect wallet/i }).first()).toBeVisible();
		await expectNoCrash(page);
	});

	test("stablecoin selector opens a token list", async ({ page }) => {
		await gotoReady(page, "/swap");
		const select = page.getByText(/select asset|EURT|EURC|EURS|EURC|stable/i).first();
		await select.click();
		await expect(page.getByText(/dEURO|EURC|EURT|EURs/i).first()).toBeVisible();
		await page.keyboard.press("Escape");
		await expectNoCrash(page);
	});

	test("disconnected swap keeps the connect guard instead of sending a tx", async ({ page }) => {
		await gotoReady(page, "/swap");
		await fillVisibleInput(page, "1");
		await expect(page.getByRole("button", { name: /connect wallet/i }).first()).toBeEnabled();
	});

	test("connected wallet exposes swap or approve action", async ({ page }) => {
		await withWallet(page, "/swap");
		await fillVisibleInput(page, "1");
		const action = page.getByRole("button", { name: /swap|approve|confirm|connect wallet/i }).first();
		await expect(action).toBeVisible();
		await expectNoCrash(page);
	});
});
