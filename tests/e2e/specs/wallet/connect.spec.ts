import { test, expect, chromium, type BrowserContext } from "@playwright/test";
import { MetaMask, getExtensionId } from "@synthetixio/synpress-metamask/playwright";
import { prepareExtension } from "@synthetixio/synpress-cache";

const SEED_PHRASE = process.env.WALLET_SEED_PHRASE || "";
const WALLET_PASSWORD = process.env.WALLET_PASSWORD || "";

if (!SEED_PHRASE || !WALLET_PASSWORD) {
	throw new Error("WALLET_SEED_PHRASE and WALLET_PASSWORD must be set in environment variables");
}

test.describe("Wallet Connect", () => {
	let context: BrowserContext;
	let metamask: MetaMask;

	test.beforeAll(async () => {
		const extensionPath = await prepareExtension();

		context = await chromium.launchPersistentContext("", {
			headless: false,
			viewport: { width: 1280, height: 720 },
			args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
		});

		const extensionId = await getExtensionId(context, "MetaMask");

		await new Promise((r) => setTimeout(r, 2000));
		const pages = context.pages();
		const metamaskPage = pages.find((p) => p.url().includes("chrome-extension://"));
		if (!metamaskPage) throw new Error("MetaMask not found");

		metamask = new MetaMask(context, metamaskPage, WALLET_PASSWORD, extensionId);
		await metamask.importWallet(SEED_PHRASE);
	});

	test.afterAll(async () => {
		await context?.close();
	});

	test("connect and verify with screenshots", async () => {
		const page = await context.newPage();

		// Step 1: Load homepage
		await page.goto("/");
		await page.waitForLoadState("networkidle");
		await expect(page).toHaveScreenshot("01-homepage-before-connect.png");

		// Step 2: Click connect button
		const connectButton = page.getByRole("button", { name: /connect/i });
		await expect(connectButton).toBeVisible({ timeout: 10000 });
		await expect(page).toHaveScreenshot("02-connect-button-visible.png");
		await connectButton.click();

		// Step 3: Wallet modal open
		await page.waitForTimeout(1000);
		await expect(page).toHaveScreenshot("03-wallet-modal-open.png");

		// Step 4: Click MetaMask
		const walletOption = page.getByText(/metamask/i).first();
		await expect(walletOption).toBeVisible({ timeout: 5000 });
		await walletOption.click();

		// Step 5: Approve in MetaMask
		await metamask.connectToDapp();
		await page.waitForTimeout(1000);

		// Step 6: Connected state
		await expect(page.locator("text=/0x[a-fA-F0-9]{4}/i").first()).toBeVisible({ timeout: 15000 });
		await expect(page).toHaveScreenshot("04-wallet-connected.png");

		// Step 7: Close any modal (e.g. Switch Network)
		await page.keyboard.press("Escape");
		await page.waitForTimeout(500);

		// Step 8: Verify connect button gone
		await expect(page.getByRole("button", { name: /connect wallet/i })).not.toBeVisible();

		// Step 9: Screenshot homepage with connected wallet
		await expect(page).toHaveScreenshot("05-homepage-wallet-connected.png");

		// Step 10: Count addresses (should be 1)
		// Dynamically get the connected address from the header button
		const addressButton = page.locator("header button:has-text('0x')").first();
		const buttonText = await addressButton.textContent();
		const addressMatch = buttonText?.match(/0x[a-fA-F0-9]{4}/);

		if (!addressMatch) throw new Error("No wallet address found in header");

		const shortAddress = addressMatch[0];

		// Count how many times this address appears in the DOM
		const count = await page.evaluate((addr) => {
			let c = 0;
			document.querySelectorAll("div,span").forEach((el) => {
				if (!el.children.length && el.textContent?.includes(addr)) c++;
			});
			return c;
		}, shortAddress);

		console.log(`\n✓ Address ${shortAddress}... count: ${count} (expected: 1)`);
		expect(count).toBe(1);

		await page.close();
	});
});
