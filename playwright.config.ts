import { defineConfig } from "@playwright/test";

// utils/constant.ts throws at module load unless this is set, which would take the
// whole suite down while collecting. An explicit value from the environment wins.
// The default is also inherited by the webServer child (yarn dev) and takes
// precedence there over values from .env files: Playwright merges process.env
// into the child environment, and Next does not overwrite already-set values.
process.env.NEXT_PUBLIC_DEPLOYMENT_ENV ??= "dev";

export default defineConfig({
	testDir: "./tests",
	timeout: 60000,
	use: {
		baseURL: "http://localhost:3000",
		headless: true,
	},
	webServer: {
		command: "yarn dev",
		port: 3000,
		timeout: 30000,
		reuseExistingServer: true,
	},
	projects: [
		{
			name: "chromium",
			use: { browserName: "chromium" },
		},
	],
});
