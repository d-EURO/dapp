import { test as base, expect, Page } from "@playwright/test";
import { gotoReady, waitForApp } from "./app";
import { connectWallet, installMockWallet, WalletOptions } from "./wallet";

export { expect };

type Fixtures = {
	readyPage: Page;
	walletPage: Page;
};

export const test = base.extend<Fixtures>({
	readyPage: async ({ page }, use) => {
		await gotoReady(page, "/dashboard");
		await use(page);
	},
	walletPage: async ({ page }, use) => {
		await installMockWallet(page);
		await gotoReady(page, "/dashboard");
		await connectWallet(page);
		await waitForApp(page);
		await use(page);
	},
});

export async function withWallet(page: Page, path: string, options?: WalletOptions): Promise<void> {
	await installMockWallet(page, options);
	await gotoReady(page, path);
	await connectWallet(page);
	await waitForApp(page);
}
