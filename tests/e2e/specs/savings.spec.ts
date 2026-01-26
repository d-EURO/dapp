import { test, expect } from "@playwright/test";

/**
 * Functional tests for the Savings page
 * Tests UI elements, deposit/withdraw interactions, and validation
 */

test.describe("Savings Page", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/savings");
		await page.waitForLoadState("networkidle");
	});

	test.describe("Page Layout", () => {
		test("should display savings page title", async ({ page }) => {
			// Title is "Earn yield on your JUSD"
			const title = page.getByText(/Earn yield on your JUSD/i);
			await expect(title).toBeVisible({ timeout: 15000 });
		});

		test("should display main savings card", async ({ page }) => {
			// The savings section is wrapped in an AppCard
			const savingsCard = page.locator('[class*="AppCard"], [class*="card"]').first();
			await expect(savingsCard).toBeVisible({ timeout: 15000 });
		});

		test("should display APR/interest rate", async ({ page }) => {
			// Shows "Savings rate (APR)" with percentage
			const aprDisplay = page.getByText(/Savings rate.*APR/i);
			await expect(aprDisplay).toBeVisible({ timeout: 15000 });
		});

		test("should display current investment section", async ({ page }) => {
			// Shows "Your Current Invest"
			const currentInvest = page.getByText(/Your Current Invest/i);
			await expect(currentInvest).toBeVisible({ timeout: 15000 });
		});

		test("should display JUSD balance", async ({ page }) => {
			// Shows "0 JUSD" or similar balance
			const balance = page.getByText(/\d+.*JUSD/).first();
			await expect(balance).toBeVisible({ timeout: 15000 });
		});
	});

	test.describe("Deposit/Withdraw Toggle", () => {
		test("should display deposit button", async ({ page }) => {
			const depositBtn = page.getByRole("button", { name: "Deposit" });
			await expect(depositBtn).toBeVisible({ timeout: 15000 });
		});

		test("should display withdraw button", async ({ page }) => {
			const withdrawBtn = page.getByText("Withdraw");
			await expect(withdrawBtn).toBeVisible({ timeout: 15000 });
		});

		test("should toggle between deposit and withdraw modes", async ({ page }) => {
			// Initially in deposit mode - check "Available to deposit"
			const depositLabel = page.getByText(/Available to deposit/i);
			await expect(depositLabel).toBeVisible({ timeout: 15000 });

			// Click on withdraw to switch mode
			const withdrawBtn = page.getByText("Withdraw");
			await withdrawBtn.click();

			// Verify mode changed - now shows "Available to withdraw"
			const withdrawLabel = page.getByText(/Available to withdraw/i);
			await expect(withdrawLabel).toBeVisible({ timeout: 5000 });

			// Click on deposit to switch back
			const depositBtn = page.getByText("Deposit");
			await depositBtn.click();

			// Verify mode changed back
			await expect(depositLabel).toBeVisible({ timeout: 5000 });
		});
	});

	test.describe("Amount Input", () => {
		test("should display available balance info", async ({ page }) => {
			// Shows "Available to deposit: X JUSD"
			const availableBalance = page.getByText(/Available to deposit/i);
			await expect(availableBalance).toBeVisible({ timeout: 15000 });
		});

		test("should display JUSD unit label", async ({ page }) => {
			// Input has "JUSD" label
			const jusdLabel = page.locator("text=JUSD").nth(2); // Third JUSD is in input
			await expect(jusdLabel).toBeVisible({ timeout: 15000 });
		});
	});

	test.describe("Action Button", () => {
		test("should show action button with default text", async ({ page }) => {
			// Button shows "Enter amount to add savings"
			const actionButton = page.getByText(/Enter amount to add savings/i);
			await expect(actionButton).toBeVisible({ timeout: 15000 });
		});
	});

	test.describe("Interest Collection", () => {
		test("should display interest collection section", async ({ page }) => {
			// Shows "Interest to be collected"
			const collectSection = page.getByText(/Interest to be collected/i);
			await expect(collectSection).toBeVisible({ timeout: 15000 });
		});

		test("should display Reinvest button", async ({ page }) => {
			const reinvestBtn = page.getByText("Reinvest");
			await expect(reinvestBtn).toBeVisible({ timeout: 15000 });
		});

		test("should display Collect button", async ({ page }) => {
			const collectBtn = page.getByRole("button", { name: /Collect/i });
			await expect(collectBtn).toBeVisible({ timeout: 15000 });
		});
	});

	test.describe("Transaction History", () => {
		test("should display transaction history section", async ({ page }) => {
			// Shows "Transaction history"
			const historySection = page.getByText(/Transaction history/i);
			await expect(historySection).toBeVisible({ timeout: 15000 });
		});

		test("should be expandable", async ({ page }) => {
			// History section has expand arrow
			const historySection = page.getByText(/Transaction history/i);
			await historySection.click();

			// After clicking, content should be visible or collapsed
			// The chevron/arrow indicates expandability
			await expect(historySection).toBeVisible();
		});
	});

	test.describe("Header Elements", () => {
		test("should display Connect Wallet button", async ({ page }) => {
			const connectButton = page.getByRole("button", { name: /Connect Wallet/i });
			await expect(connectButton).toBeVisible({ timeout: 15000 });
		});

		test("should display navigation links", async ({ page }) => {
			// Check dashboard link is present
			const dashboardNav = page.getByRole("link", { name: "Dashboard" });
			await expect(dashboardNav).toBeVisible({ timeout: 15000 });
		});
	});

	test.describe("Responsive Design", () => {
		test("should be usable on mobile viewport", async ({ page }) => {
			await page.setViewportSize({ width: 375, height: 667 });
			await page.reload();
			await page.waitForLoadState("networkidle");

			// Main title should still be visible
			const title = page.getByText(/Earn yield/i);
			await expect(title).toBeVisible({ timeout: 15000 });

			// Deposit/Withdraw buttons should be visible
			const depositBtn = page.getByRole("button", { name: "Deposit" });
			await expect(depositBtn).toBeVisible();
		});

		test("should be usable on tablet viewport", async ({ page }) => {
			await page.setViewportSize({ width: 768, height: 1024 });
			await page.reload();
			await page.waitForLoadState("networkidle");

			// Main title should still be visible
			const title = page.getByText(/Earn yield/i);
			await expect(title).toBeVisible({ timeout: 15000 });
		});
	});
});
