import { defineConfig } from "@playwright/test";

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
