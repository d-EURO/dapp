import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for JuiceDollar bApp E2E tests
 * Uses Synpress for MetaMask integration
 */
export default defineConfig({
	testDir: "./tests/e2e/specs",

	/* Run tests in files in parallel */
	fullyParallel: false, // Disabled for wallet state consistency

	/* Fail the build on CI if you accidentally left test.only in the source code */
	forbidOnly: !!process.env.CI,

	/* Retry on CI only */
	retries: process.env.CI ? 2 : 0,

	/* Opt out of parallel tests for wallet consistency */
	workers: 1,

	/* Reporter to use */
	reporter: [["html", { outputFolder: "playwright-report" }], ["list"]],

	/* Shared settings for all the projects below */
	use: {
		/* Base URL to use in actions like `await page.goto('/')` */
		baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",

		/* Collect trace when retrying the failed test */
		trace: "on-first-retry",

		/* Take screenshot on failure */
		screenshot: "only-on-failure",

		/* Video recording */
		video: "on-first-retry",
	},

	/* Configure projects for Chrome only */
	projects: [
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				// Use headed mode for MetaMask interaction
				headless: false,
			},
		},
	],

	/* Run your local dev server before starting the tests */
	webServer: {
		command: "yarn dev",
		url: "http://localhost:3000",
		reuseExistingServer: !process.env.CI,
		timeout: 120 * 1000, // 2 minutes to start
	},

	/* Global timeout for each test */
	timeout: 60 * 1000, // 60 seconds per test

	/* Expect timeout */
	expect: {
		timeout: 10 * 1000, // 10 seconds for assertions
		/* Visual regression testing settings */
		toHaveScreenshot: {
			maxDiffPixelRatio: 0.01,
			animations: "disabled",
		},
	},

	/* Snapshot settings */
	snapshotDir: "./tests/e2e/snapshots",
	snapshotPathTemplate: "{snapshotDir}/{testFilePath}/{arg}{ext}",
});
