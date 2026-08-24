import { defineConfig, devices } from "@playwright/test";
import path from "path";

process.env.NEXT_PUBLIC_DEPLOYMENT_ENV ??= "dev";
process.env.NEXT_PUBLIC_CHAIN_NAME ??= "mainnet";
process.env.NEXT_PUBLIC_RPC_URL_MAINNET ??= "https://eth.llamarpc.com";
process.env.NEXT_PUBLIC_RPC_URL_POLYGON ??= "https://polygon.llamarpc.com";
process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ??= "";
process.env.NEXT_PUBLIC_API_URL ??= "https://api.deuro.com";
process.env.NEXT_PUBLIC_PONDER_URL ??= "https://ponder.deuro.com";
process.env.NEXT_PUBLIC_PONDER_FALLBACK_URL ??= "https://dev.ponder.deuro.com/";
process.env.NEXT_PUBLIC_LANDINGPAGE_URL ??= "https://deuro.com";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
process.env.NEXT_PUBLIC_E2E ??= "1";

const nextEnv: Record<string, string> = {
	NEXT_PUBLIC_DEPLOYMENT_ENV: process.env.NEXT_PUBLIC_DEPLOYMENT_ENV,
	NEXT_PUBLIC_CHAIN_NAME: process.env.NEXT_PUBLIC_CHAIN_NAME,
	NEXT_PUBLIC_RPC_URL_MAINNET: process.env.NEXT_PUBLIC_RPC_URL_MAINNET,
	NEXT_PUBLIC_RPC_URL_POLYGON: process.env.NEXT_PUBLIC_RPC_URL_POLYGON,
	NEXT_PUBLIC_ALCHEMY_API_KEY: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
	NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
	NEXT_PUBLIC_PONDER_URL: process.env.NEXT_PUBLIC_PONDER_URL,
	NEXT_PUBLIC_PONDER_FALLBACK_URL: process.env.NEXT_PUBLIC_PONDER_FALLBACK_URL,
	NEXT_PUBLIC_LANDINGPAGE_URL: process.env.NEXT_PUBLIC_LANDINGPAGE_URL,
	NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
	NEXT_PUBLIC_E2E: "1",
};

export default defineConfig({
	testDir: "./tests",
	timeout: 90_000,
	expect: { timeout: 20_000 },
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 2 : 3,
	reporter: [
		["list"],
		["html", { open: "never", outputFolder: "playwright-report" }],
		["json", { outputFile: "test-results/results.json" }],
	],
	outputDir: "test-results/artifacts",
	use: {
		baseURL: "http://localhost:3000",
		headless: true,
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
		actionTimeout: 20_000,
		navigationTimeout: 60_000,
	},
	webServer: {
		command: "npx next dev -p 3000",
		url: "http://localhost:3000",
		timeout: 180_000,
		reuseExistingServer: !process.env.CI,
		cwd: path.resolve(__dirname),
		env: nextEnv,
	},
	projects: [
		{
			name: "unit",
			testMatch: /unit\/.*\.spec\.ts/,
			use: { ...devices["Desktop Chrome"] },
		},
		{
			name: "e2e-chromium",
			testMatch: /e2e\/.*\.spec\.ts/,
			testIgnore: /responsive\.spec\.ts/,
			use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1100 } },
		},
		{
			name: "e2e-mobile",
			testMatch: /e2e\/responsive\.spec\.ts/,
			use: { ...devices["iPhone 13"], browserName: "chromium" },
		},
	],
});
