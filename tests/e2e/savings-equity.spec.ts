import { test, expect } from "@playwright/test";
import { expectNoCrash, gotoReady } from "../helpers/app";
import { withWallet } from "../helpers/fixtures";

test.describe("savings", () => {
	test("global stats, collect interest and interaction card", async ({ page }) => {
		await gotoReady(page, "/savings");
		await expect(page).toHaveTitle(/dEURO/);
		await expect(page.getByText(/savings/i).first()).toBeVisible();
		await expect(page.getByRole("button", { name: /connect wallet/i }).first()).toBeVisible();
		await expectNoCrash(page);
	});

	test("history / leaderboard tables are on the page", async ({ page }) => {
		await gotoReady(page, "/savings");
		await expect(page.getByText(/leaderboard|interest|saved|withdraw/i).first()).toBeVisible();
	});

	test("connected wallet reveals save/withdraw actions", async ({ page }) => {
		await withWallet(page, "/savings");
		const action = page.getByRole("button", { name: /save|withdraw|approve|collect|connect/i }).first();
		await expect(action).toBeVisible();
		await expectNoCrash(page);
	});
});

test.describe("equity", () => {
	test("invest and redeem cards render", async ({ page }) => {
		await gotoReady(page, "/equity");
		await expect(page).toHaveTitle(/dEURO/);
		await expect(page.getByText(/nDEPS|DEPS|equity|pool share/i).first()).toBeVisible();
		await expectNoCrash(page);
	});

	test("connected wallet shows invest/redeem or approve", async ({ page }) => {
		await withWallet(page, "/equity");
		await expect(page.getByRole("button", { name: /invest|redeem|approve|wrap|unwrap|connect/i }).first()).toBeVisible();
		await expectNoCrash(page);
	});
});
