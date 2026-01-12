import { test, expect, Page } from "@playwright/test";

/**
 * Visual regression tests - capture and compare page screenshots
 * Run `yarn test:e2e:visual:update` to update baseline images
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://dev.api.testnet.juicedollar.com";

interface TestData {
	position: string;
	challengeIndex: string;
}

/**
 * Fetch test data dynamically from the API
 */
async function fetchTestData(): Promise<TestData> {
	// Get first open position
	const positionsRes = await fetch(`${API_URL}/positions/list`);
	const positionsData = await positionsRes.json();
	const openPosition = positionsData.list.find((p: { closed: boolean }) => !p.closed);

	if (!openPosition) {
		throw new Error("No open position found for testing");
	}

	// Get first active challenge
	const challengesRes = await fetch(`${API_URL}/challenges/list`);
	const challengesData = await challengesRes.json();
	const activeChallenge = challengesData.list.find((c: { status: string }) => c.status === "Active");

	if (!activeChallenge) {
		throw new Error("No active challenge found for testing");
	}

	return {
		position: openPosition.position,
		challengeIndex: activeChallenge.number,
	};
}

/**
 * Normalize scrollbars for consistent screenshot dimensions across platforms.
 * Must be called early (before waiting for content) to ensure consistent rendering.
 */
async function normalizeScrollbars(page: Page): Promise<void> {
	await page.addStyleTag({
		content: `
			*, *::before, *::after {
				scrollbar-width: none !important;
				-ms-overflow-style: none !important;
			}
			*::-webkit-scrollbar {
				display: none !important;
				width: 0 !important;
				height: 0 !important;
			}
		`,
	});
}

/**
 * Wait for ApexCharts to fully render (including SVG path content).
 * Used for pages with dynamic charts that load asynchronously.
 */
async function waitForCharts(page: Page): Promise<void> {
	try {
		await page.waitForSelector(".apexcharts-area-series path", { state: "visible", timeout: 20000 });
		await page.waitForTimeout(1000);
	} catch {
		try {
			await page.waitForSelector(".apexcharts-svg", { state: "visible", timeout: 10000 });
			await page.waitForTimeout(1000);
		} catch {
			// Chart might not exist on this page
		}
	}
}

test.describe("Visual Regression", () => {
	test("dashboard page", async ({ page }) => {
		await page.goto("/dashboard");
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveScreenshot("dashboard.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("mint page", async ({ page }) => {
		await page.goto("/mint");
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveScreenshot("mint.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("savings page", async ({ page }) => {
		await page.goto("/savings");
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");
		await waitForCharts(page);

		await expect(page).toHaveScreenshot("savings.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("savings page - click withdraw tab", async ({ page }) => {
		await page.goto("/savings");
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");
		await waitForCharts(page);

		// Click "Withdraw" tab
		await page.getByText("Withdraw").click();
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveScreenshot("savings-withdraw-tab.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("equity page", async ({ page }) => {
		await page.goto("/equity");
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");
		await waitForCharts(page);

		await expect(page).toHaveScreenshot("equity.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("governance page", async ({ page }) => {
		await page.goto("/governance");
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveScreenshot("governance.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("challenges page", async ({ page }) => {
		await page.goto("/challenges");
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveScreenshot("challenges.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("swap page", async ({ page }) => {
		await page.goto("/swap");
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveScreenshot("swap.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("referrals page", async ({ page }) => {
		await page.goto("/referrals");
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveScreenshot("referrals.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("monitoring page", async ({ page }) => {
		await page.goto("/monitoring");
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveScreenshot("monitoring.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("mypositions page", async ({ page }) => {
		await page.goto("/mypositions");
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveScreenshot("mypositions.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("mint create page", async ({ page }) => {
		await page.goto("/mint/create");
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveScreenshot("mint-create.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("404 page", async ({ page }) => {
		await page.goto("/nonexistent-page-for-404-test");
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveScreenshot("404.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	// Dynamic pages with real testnet data fetched from API
	let testData: TestData;

	test.beforeAll(async () => {
		testData = await fetchTestData();
	});

	test("mint position detail page", async ({ page }) => {
		await page.goto(`/mint/${testData.position}`);
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveScreenshot("mint-position-detail.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("mint position manage page", async ({ page }) => {
		await page.goto(`/mint/${testData.position}/manage`);
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveScreenshot("mint-position-manage.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("mint position manage - click loan button", async ({ page }) => {
		await page.goto(`/mint/${testData.position}/manage`);
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");

		// Click "Adjust Loan Amount" button
		await page.locator("button", { hasText: "Adjust Loan Amount" }).click();
		await page.waitForLoadState("networkidle");

		// Verify navigation succeeded
		await expect(page).toHaveURL(/\/manage\/loan/);

		await expect(page).toHaveScreenshot("mint-position-manage-loan-via-button.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("mint position manage - click collateral button", async ({ page }) => {
		await page.goto(`/mint/${testData.position}/manage`);
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");

		// Click "Adjust Collateral" button
		await page.locator("button", { hasText: "Adjust Collateral" }).click();
		await page.waitForLoadState("networkidle");

		// Verify navigation succeeded
		await expect(page).toHaveURL(/\/manage\/collateral/);

		await expect(page).toHaveScreenshot("mint-position-manage-collateral-via-button.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("mint position manage - click liquidation price button", async ({ page }) => {
		await page.goto(`/mint/${testData.position}/manage`);
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");

		// Click "Adjust Liquidation Price" button
		await page.locator("button", { hasText: "Adjust Liquidation Price" }).click();
		await page.waitForLoadState("networkidle");

		// Verify navigation succeeded
		await expect(page).toHaveURL(/\/manage\/liquidation-price/);

		await expect(page).toHaveScreenshot("mint-position-manage-liqprice-via-button.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("mint position manage - click expiration button", async ({ page }) => {
		await page.goto(`/mint/${testData.position}/manage`);
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");

		// Click "Adjust Expiration" button
		await page.locator("button", { hasText: "Adjust Expiration" }).click();
		await page.waitForLoadState("networkidle");

		// Verify navigation succeeded
		await expect(page).toHaveURL(/\/manage\/expiration/);

		await expect(page).toHaveScreenshot("mint-position-manage-expiration-via-button.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("mint position manage collateral page", async ({ page }) => {
		await page.goto(`/mint/${testData.position}/manage/collateral`);
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveScreenshot("mint-position-manage-collateral.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("mint position manage collateral - click remove tab", async ({ page }) => {
		await page.goto(`/mint/${testData.position}/manage/collateral`);
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");

		// Click "Remove" tab
		await page.getByText("Remove").click();
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveScreenshot("mint-position-manage-collateral-remove-tab.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("mint position manage expiration page", async ({ page }) => {
		await page.goto(`/mint/${testData.position}/manage/expiration`);
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveScreenshot("mint-position-manage-expiration.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("mint position manage liquidation-price page", async ({ page }) => {
		await page.goto(`/mint/${testData.position}/manage/liquidation-price`);
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveScreenshot("mint-position-manage-liqprice.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("mint position manage loan page", async ({ page }) => {
		await page.goto(`/mint/${testData.position}/manage/loan`);
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveScreenshot("mint-position-manage-loan.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("mint position manage loan - click repay tab", async ({ page }) => {
		await page.goto(`/mint/${testData.position}/manage/loan`);
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");

		// Click "Repay Loan" tab
		await page.getByText("Repay Loan").click();
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveScreenshot("mint-position-manage-loan-repay-tab.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("monitoring position detail page", async ({ page }) => {
		await page.goto(`/monitoring/${testData.position}`);
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveScreenshot("monitoring-position-detail.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("monitoring position - click manage button", async ({ page }) => {
		await page.goto(`/monitoring/${testData.position}`);
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");

		// Click "Manage" button
		await page.locator("button", { hasText: "Manage" }).click();
		await page.waitForLoadState("networkidle");

		// Verify navigation to manage page
		await expect(page).toHaveURL(/\/manage/);

		await expect(page).toHaveScreenshot("monitoring-position-manage-via-button.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("monitoring position - click challenge button", async ({ page }) => {
		await page.goto(`/monitoring/${testData.position}`);
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");

		// Click "Challenge" button (or "Force Sell" depending on maturity)
		await page.locator("a", { hasText: /Challenge|Force Sell/ }).click();
		await page.waitForLoadState("networkidle");

		// Verify navigation to challenge or forceSell page
		await expect(page).toHaveURL(/\/(challenge|forceSell)/);

		await expect(page).toHaveScreenshot("monitoring-position-challenge-via-button.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("monitoring position challenge page", async ({ page }) => {
		await page.goto(`/monitoring/${testData.position}/challenge`);
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveScreenshot("monitoring-position-challenge.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("monitoring position forceSell page", async ({ page }) => {
		await page.goto(`/monitoring/${testData.position}/forceSell`);
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveScreenshot("monitoring-position-forcesell.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("mypositions adjust page", async ({ page }) => {
		await page.goto(`/mypositions/${testData.position}/adjust`);
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveScreenshot("mypositions-adjust.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("challenges bid page", async ({ page }) => {
		await page.goto(`/challenges/${testData.challengeIndex}/bid`);
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveScreenshot("challenges-bid.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("mobile viewport - dashboard", async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto("/dashboard");
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveScreenshot("dashboard-mobile.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});

	test("tablet viewport - dashboard", async ({ page }) => {
		await page.setViewportSize({ width: 768, height: 1024 });
		await page.goto("/dashboard");
		await normalizeScrollbars(page);
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveScreenshot("dashboard-tablet.png", {
			fullPage: true,
			maxDiffPixelRatio: 0.01,
		});
	});
});
