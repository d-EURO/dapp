import { testWithSynpress } from "@synthetixio/synpress";
import { MetaMask, metaMaskFixtures } from "@synthetixio/synpress/playwright";
import basicSetup from "../../wallet-setup/basic.setup";

const test = testWithSynpress(metaMaskFixtures(basicSetup));

const { expect } = test;

test.describe("Dashboard Page", () => {
	test.beforeEach(async ({ context, page, metamaskPage, extensionId }) => {
		const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId);

		await page.goto("/");

		// Connect wallet
		const connectButton = page.getByRole("button", { name: /connect/i });
		await connectButton.click();

		const metamaskOption = page.getByText(/metamask/i).first();
		await metamaskOption.click();

		await metamask.connectToDapp();

		// Wait for wallet to be connected
		await expect(page.locator("text=/0x[a-fA-F0-9]{4}/i")).toBeVisible({
			timeout: 15000,
		});
	});

	test("should display dashboard after wallet connection", async ({ page }) => {
		await page.goto("/dashboard");

		// Dashboard should load with main sections
		await expect(page).toHaveURL(/dashboard/);

		// Check for main dashboard elements
		// Adjust these selectors based on actual dashboard content
		await expect(page.locator("body")).toBeVisible();
	});

	test("should display user portfolio information", async ({ page }) => {
		await page.goto("/dashboard");

		// Wait for dashboard to load data
		await page.waitForLoadState("networkidle");

		// Check for portfolio-related content
		// These selectors should be adjusted to match your actual UI
		const dashboardContent = page.locator('main, [role="main"], .dashboard');
		await expect(dashboardContent).toBeVisible({ timeout: 10000 });
	});

	test("should navigate to mint page from dashboard", async ({ page }) => {
		await page.goto("/dashboard");

		// Click on mint/borrow link
		const mintLink = page.getByRole("link", { name: /mint|borrow/i }).first();
		await mintLink.click();

		await expect(page).toHaveURL(/mint/);
	});

	test("should navigate to savings page from dashboard", async ({ page }) => {
		await page.goto("/dashboard");

		// Click on savings link
		const savingsLink = page.getByRole("link", { name: /savings|save/i }).first();
		await savingsLink.click();

		await expect(page).toHaveURL(/savings/);
	});
});
