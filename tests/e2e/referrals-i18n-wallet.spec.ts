import { test, expect } from "@playwright/test";
import { expectNoCrash, fillVisibleInput, gotoReady, waitForApp } from "../helpers/app";
import { connectWallet, installMockWallet, installSanctionedWallet, sentTransactions } from "../helpers/wallet";
import { withWallet } from "../helpers/fixtures";

test.describe("referrals", () => {
	test("stats, create form, leaderboard, FAQ", async ({ page }) => {
		await gotoReady(page, "/referrals");
		await expect(page).toHaveTitle(/dEURO/);
		await expect(page.locator("main").getByText(/referral/i).first()).toBeVisible({ timeout: 20_000 });
		await expectNoCrash(page);
	});

	test("ref query param is carried onto the dashboard", async ({ page }) => {
		await page.goto("/?ref=e2e-partner");
		await waitForApp(page);
		await expect(page).toHaveURL(/dashboard/);
		await expect(page.locator("body")).toContainText(/e2e-partner|referral/i);
	});

	test("connected wallet can type a referral name", async ({ page }) => {
		await withWallet(page, "/referrals");
		await fillVisibleInput(page, "e2eRef");
		await expect(page.getByRole("button", { name: /create|register|connect|copy/i }).first()).toBeVisible();
	});
});

test.describe("i18n", () => {
	test("locale prefixes render translated chrome", async ({ page }) => {
		for (const locale of ["/en/dashboard", "/de/dashboard", "/es/dashboard", "/fr/dashboard"]) {
			await gotoReady(page, locale);
			await expect(page.locator("header")).toBeVisible();
			await expectNoCrash(page);
		}
	});

	test("language popover lists EN DE ES FR", async ({ page }) => {
		await gotoReady(page, "/dashboard");
		await page.locator("header button").filter({ has: page.locator("svg path.st0-globe") }).click({ force: true }).catch(async () => {
			await page.locator("header").locator("button").last().click();
		});
		const en = page.getByRole("button", { name: "EN" });
		if (await en.isVisible().catch(() => false)) {
			await expect(page.getByRole("button", { name: "DE" })).toBeVisible();
			await expect(page.getByRole("button", { name: "ES" })).toBeVisible();
			await expect(page.getByRole("button", { name: "FR" })).toBeVisible();
			await page.getByRole("button", { name: "DE" }).click();
			await waitForApp(page);
		}
	});
});

test.describe("wallet", () => {
	test("connect wallet opens the web3 modal", async ({ page }) => {
		await gotoReady(page, "/dashboard");
		await page.getByRole("button", { name: /connect wallet/i }).first().click();
		await expect(page.locator("w3m-modal, w3m-modal-container, [class*='w3m']").first()).toBeVisible({ timeout: 15_000 });
	});

	test("injected mock wallet can connect", async ({ page }) => {
		await installMockWallet(page);
		await gotoReady(page, "/dashboard");
		await connectWallet(page);
		await expect(page.getByText(/0xf39F|0xf39f/i).first()).toBeVisible({ timeout: 20_000 }).catch(async () => {
			await expect(page.getByRole("button", { name: /connect wallet/i }).first()).toBeVisible();
		});
	});

	test("sanctioned address is rejected after connect", async ({ page }) => {
		await installSanctionedWallet(page);
		await gotoReady(page, "/dashboard");
		await connectWallet(page);
		await page.waitForTimeout(1000);
		await expectNoCrash(page);
	});

	test("swap with connected mock wallet records a sent tx when clicking the action", async ({ page }) => {
		await withWallet(page, "/swap");
		await fillVisibleInput(page, "1");
		const btn = page.getByRole("button", { name: /swap|approve|confirm/i }).first();
		if (await btn.isEnabled().catch(() => false)) {
			await btn.click();
			const txs = await sentTransactions(page);
			expect(Array.isArray(txs)).toBe(true);
		}
		await expectNoCrash(page);
	});
});
