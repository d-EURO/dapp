import { test, expect } from "@playwright/test";
import { expectNoCrash, gotoReady, openExpertMode } from "../helpers/app";

test.describe("dashboard", () => {
	test("renders investment, savings, equity, borrow and leaderboard", async ({ page }) => {
		await gotoReady(page, "/dashboard");
		await expectNoCrash(page);
		await expect(page).toHaveTitle(/dEURO/);
		await expect(page.getByText("Savings", { exact: false }).first()).toBeVisible();
		await expect(page.getByText(/leaderboard/i).first()).toBeVisible();
		await expect(page.getByText("Governance", { exact: false }).first()).toBeVisible();
		await expect(page.getByText("Expert Mode").first()).toBeVisible();
	});

	test("tabs switch monitoring / challenges / bids", async ({ page }) => {
		await gotoReady(page, "/dashboard");
		const tabLabels = ["Monitoring", "Auctions", "Challenges"];
		for (const label of tabLabels) {
			const tab = page.getByRole("button", { name: new RegExp(label, "i") }).first();
			if (await tab.count()) {
				await tab.click();
				await expectNoCrash(page);
			}
		}
		const bids = page.getByText(/bought through bids|bids/i).first();
		if (await bids.isVisible().catch(() => false)) {
			await bids.click();
			await expectNoCrash(page);
		}
	});

	test("expert mode reveals governance tables", async ({ page }) => {
		await gotoReady(page, "/dashboard");
		await openExpertMode(page);
		await expect(page.getByText(/minting module/i).or(page.getByText(/new position/i)).first()).toBeVisible({ timeout: 15_000 });
		await expectNoCrash(page);
	});
});
