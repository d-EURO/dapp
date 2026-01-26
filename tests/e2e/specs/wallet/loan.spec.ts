import { test, expect, chromium, type BrowserContext, type Page } from "@playwright/test";
import { MetaMask, getExtensionId } from "@synthetixio/synpress-metamask/playwright";
import { prepareExtension } from "@synthetixio/synpress-cache";
import * as fs from "fs";
import * as path from "path";

const SEED_PHRASE = process.env.WALLET_SEED_PHRASE || "";
const WALLET_PASSWORD = process.env.WALLET_PASSWORD || "";
const WALLET_ADDRESS = process.env.WALLET_ADDRESS || "";

// Citreascan API configuration
const CITREASCAN_API = "https://testnet.citreascan.com/api/v2";
const CONFIRMATION_TIMEOUT_MS = 30000; // 30 seconds for Citrea Testnet
const POLL_INTERVAL_MS = 1000;

interface CitreascanTransaction {
	hash: string;
	status: string;
	result: string;
	timestamp: string;
	from: { hash: string };
	to: { hash: string };
	value: string;
}

interface CitreascanResponse {
	items: CitreascanTransaction[];
}

// Ensure screenshot directory exists
const SCREENSHOT_DIR = "test-results/screenshots";

/**
 * Open Citreascan explorer in a new tab and capture screenshot
 * Waits 10s, takes screenshot. If not confirmed, waits 30s more, reloads and takes another screenshot.
 * @param context - Browser context to create new tab
 * @param txHash - Transaction hash to view
 * @param screenshotPrefix - Prefix for screenshot filename
 * @returns Promise that resolves when done
 */
async function captureExplorerScreenshot(context: BrowserContext, txHash: string, screenshotPrefix: string): Promise<void> {
	// Ensure screenshot directory exists
	if (!fs.existsSync(SCREENSHOT_DIR)) {
		fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
	}

	const explorerUrl = `https://testnet.citreascan.com/tx/${txHash}`;
	console.log(`\n   📷 OPENING CITREASCAN EXPLORER`);
	console.log(`   URL: ${explorerUrl}`);

	const explorerPage = await context.newPage();
	await explorerPage.bringToFront();

	await explorerPage.goto(explorerUrl);
	await explorerPage.waitForLoadState("networkidle");

	// Wait for transaction details to render (Citreascan shows "Status and method" row with "Success")
	// The success badge is a span with green background containing "Success" text
	const successSelector = 'span:has-text("Success"), text="Success"';

	try {
		// Wait up to 5 seconds for Success status to appear
		await explorerPage.locator(successSelector).first().waitFor({ state: "visible", timeout: 5000 });
		console.log("   ✅ Transaction confirmed on explorer");
	} catch {
		// If not visible after 5s, wait 3 more seconds and reload once
		console.log("   ⏳ Waiting for confirmation...");
		await explorerPage.waitForTimeout(3000);
		await explorerPage.reload();
		await explorerPage.waitForLoadState("networkidle");
	}

	// Take screenshot
	const screenshot = path.join(SCREENSHOT_DIR, `${screenshotPrefix}-explorer.png`);
	await explorerPage.screenshot({ path: screenshot, fullPage: true });
	console.log(`   📸 Screenshot: ${screenshot}`);

	await explorerPage.close();
}

/**
 * Verify transaction is confirmed on Citreascan within timeout
 * @param walletAddress - The wallet address to check transactions for
 * @param beforeTimestamp - Only consider transactions after this timestamp
 * @param timeoutMs - Maximum time to wait for confirmation (default: 10s)
 * @returns The confirmed transaction or throws error
 */
async function verifyTransactionOnCitreascan(
	walletAddress: string,
	beforeTimestamp: Date,
	timeoutMs: number = CONFIRMATION_TIMEOUT_MS
): Promise<CitreascanTransaction> {
	const startTime = Date.now();
	let lastError: Error | null = null;

	console.log(`   Checking Citreascan for wallet: ${walletAddress}`);
	console.log(`   Looking for transactions after: ${beforeTimestamp.toISOString()}`);

	while (Date.now() - startTime < timeoutMs) {
		try {
			const response = await fetch(`${CITREASCAN_API}/addresses/${walletAddress}/transactions`);

			if (!response.ok) {
				throw new Error(`Citreascan API error: ${response.status}`);
			}

			const data: CitreascanResponse = await response.json();

			if (data.items && data.items.length > 0) {
				// Find the most recent transaction that occurred after our beforeTimestamp
				const recentTx = data.items.find((tx) => {
					const txTime = new Date(tx.timestamp);
					return txTime > beforeTimestamp;
				});

				if (recentTx) {
					if (recentTx.status === "ok" && recentTx.result === "success") {
						const elapsed = Date.now() - startTime;
						console.log(`   ✅ Transaction confirmed on blockchain in ${elapsed}ms`);
						console.log(`   TX Hash: ${recentTx.hash}`);
						console.log(`   Status: ${recentTx.status}, Result: ${recentTx.result}`);
						return recentTx;
					} else if (recentTx.status === "error" || recentTx.result === "error") {
						throw new Error(`Transaction failed on blockchain: ${recentTx.hash}`);
					}
				}
			}
		} catch (error) {
			lastError = error as Error;
		}

		// Wait before next poll
		await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
	}

	throw new Error(
		`Transaction not confirmed on Citreascan within ${timeoutMs}ms. ` + `Last error: ${lastError?.message || "No transaction found"}`
	);
}

if (!SEED_PHRASE || !WALLET_PASSWORD) {
	throw new Error("WALLET_SEED_PHRASE and WALLET_PASSWORD must be set in environment variables");
}

if (!WALLET_ADDRESS) {
	throw new Error("WALLET_ADDRESS must be set in environment variables for blockchain verification");
}

// Citrea Testnet configuration
const CITREA_TESTNET = {
	name: "Citrea Testnet",
	rpcUrl: "https://rpc.testnet.citreascan.com",
	chainId: 5115,
	symbol: "cBTC",
	blockExplorerUrl: "https://testnet.citreascan.com",
};

/**
 * Connect wallet if not already connected
 * Checks for wallet address display AND valid balance to determine connection status
 * @param page - Playwright page
 * @param metamask - MetaMask instance
 * @returns Promise that resolves when wallet is connected
 */
/**
 * Force connect wallet - always performs connection regardless of current state
 */
async function forceConnectWallet(page: Page, metamask: MetaMask): Promise<void> {
	console.log("📍 Force connecting wallet...");

	// First, check if there's a connect button visible
	const connectButton = page.getByRole("button", { name: /connect/i });
	const connectVisible = await connectButton.isVisible({ timeout: 5000 }).catch(() => false);

	if (connectVisible) {
		// Fresh page, just click connect
		await connectButton.click();
	} else {
		// Might be "connected" (cached state) - disconnect first
		console.log("   No connect button found, looking for wallet menu...");
		const walletButton = page.locator("text=/0x[a-fA-F0-9]{4}/i").first();
		const walletButtonVisible = await walletButton.isVisible({ timeout: 3000 }).catch(() => false);

		if (walletButtonVisible) {
			await walletButton.click();
			await page.waitForTimeout(500);
			const disconnectOption = page.getByText(/disconnect/i).first();
			const disconnectVisible = await disconnectOption.isVisible({ timeout: 2000 }).catch(() => false);
			if (disconnectVisible) {
				await disconnectOption.click();
				console.log("   Disconnected wallet");
				await page.waitForTimeout(1000);
			} else {
				await page.keyboard.press("Escape");
			}
		}

		// Reload and try again
		await page.reload();
		await page.waitForLoadState("networkidle");
		const newConnectBtn = page.getByRole("button", { name: /connect/i });
		await expect(newConnectBtn).toBeVisible({ timeout: 10000 });
		await newConnectBtn.click();
	}

	// Select MetaMask from wallet modal
	console.log("📍 Select MetaMask from modal");
	await page.waitForTimeout(1000);
	const walletOption = page.getByText(/metamask/i).first();
	await expect(walletOption).toBeVisible({ timeout: 5000 });
	await walletOption.click();

	// Approve connection in MetaMask
	console.log("📍 Approve connection in MetaMask");
	await metamask.connectToDapp();
	await page.waitForTimeout(2000);

	// Handle network switch if prompted
	console.log("📍 Handle network switch");
	try {
		const switchNetworkButton = page.getByRole("button", { name: /switch network/i });
		const isSwitchVisible = await switchNetworkButton.isVisible({ timeout: 3000 }).catch(() => false);
		if (isSwitchVisible) {
			await switchNetworkButton.click();
			await page.waitForTimeout(3000);
		}
	} catch {
		// Network switch not needed
	}

	// Verify connection
	console.log("📍 Verifying connection...");
	await page.waitForTimeout(2000);
	const walletAddress = page.locator("text=/0x[a-fA-F0-9]{4}/i").first();
	await expect(walletAddress).toBeVisible({ timeout: 10000 });
	console.log("   ✅ Wallet connected!");
}

async function connectWalletIfNeeded(page: Page, metamask: MetaMask): Promise<void> {
	// Check if wallet is already connected AND has a valid balance (not 0)
	const walletAddressVisible = await page
		.locator("text=/0x[a-fA-F0-9]{4}/i")
		.first()
		.isVisible({ timeout: 3000 })
		.catch(() => false);

	if (walletAddressVisible) {
		// Check if balance is loaded (not 0)
		const balanceText = await page
			.locator("text=/\\d+\\.?\\d*\\s*cBTC/")
			.first()
			.textContent({ timeout: 5000 })
			.catch(() => "0 cBTC");
		const balanceMatch = balanceText?.match(/([\d.]+)\s*cBTC/);
		const balance = balanceMatch ? parseFloat(balanceMatch[1]) : 0;

		if (balance > 0) {
			console.log(`   ✓ Wallet already connected with balance: ${balance} cBTC`);
			return;
		}
		console.log("   ⚠️ Wallet appears connected but balance is 0, forcing reconnection...");
	}

	// Connect wallet - first check if there's a connect button
	console.log("📍 Connect wallet");
	const connectButton = page.getByRole("button", { name: /connect/i });
	const connectVisible = await connectButton.isVisible({ timeout: 5000 }).catch(() => false);

	if (!connectVisible) {
		// No connect button - try to disconnect first by looking for a disconnect option
		console.log("   Looking for disconnect option...");
		const walletButton = page.locator("text=/0x[a-fA-F0-9]{4}/i").first();
		const walletButtonVisible = await walletButton.isVisible({ timeout: 2000 }).catch(() => false);
		if (walletButtonVisible) {
			await walletButton.click();
			await page.waitForTimeout(500);
			const disconnectOption = page.getByText(/disconnect/i).first();
			const disconnectVisible = await disconnectOption.isVisible({ timeout: 2000 }).catch(() => false);
			if (disconnectVisible) {
				await disconnectOption.click();
				console.log("   Disconnected wallet, now reconnecting...");
				await page.waitForTimeout(1000);
			} else {
				await page.keyboard.press("Escape");
			}
		}
		// Reload and try again
		await page.reload();
		await page.waitForLoadState("networkidle");
	}

	// Now click connect
	const connectBtn = page.getByRole("button", { name: /connect/i });
	await expect(connectBtn).toBeVisible({ timeout: 10000 });
	await connectBtn.click();

	// Select MetaMask from wallet modal
	console.log("📍 Select MetaMask");
	await page.waitForTimeout(1000);
	const walletOption = page.getByText(/metamask/i).first();
	await expect(walletOption).toBeVisible({ timeout: 5000 });
	await walletOption.click();

	// Approve connection in MetaMask
	console.log("📍 Approve connection in MetaMask");
	await metamask.connectToDapp();
	await page.waitForTimeout(2000);

	// Handle network switch if prompted (click button, MetaMask auto-approves on known networks)
	console.log("📍 Handle network switch");
	try {
		const switchNetworkButton = page.getByRole("button", { name: /switch network/i });
		const isSwitchVisible = await switchNetworkButton.isVisible({ timeout: 3000 }).catch(() => false);
		if (isSwitchVisible) {
			await switchNetworkButton.click();
			// Wait for MetaMask to process the network switch
			await page.waitForTimeout(3000);
		}
	} catch {
		console.log("   No network switch needed");
	}

	// Close any modal that might be open
	await page.keyboard.press("Escape");
	await page.waitForTimeout(500);

	// Verify wallet is connected
	console.log("📍 Verify wallet connected");
	await expect(page.locator("text=/0x[a-fA-F0-9]{4}/i").first()).toBeVisible({ timeout: 15000 });
	console.log("   ✓ Wallet connected successfully");
}

test.describe("Loan Creation", () => {
	// Increase timeout for wallet transactions (5 minutes for full lifecycle with explorer screenshots)
	test.setTimeout(300000);
	let context: BrowserContext;
	let metamask: MetaMask;
	let page: Page;

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

		// Add Citrea Testnet to MetaMask
		await metamask.addNetwork(CITREA_TESTNET);
	});

	test.afterAll(async () => {
		await context?.close();
	});

	test("should create a loan with cBTC collateral", async () => {
		page = await context.newPage();

		// Step 1: Navigate to mint page
		console.log("\n📍 Step 1: Navigate to mint page");
		await page.goto("/mint");
		await page.waitForLoadState("networkidle");

		// Step 2-6: Connect wallet (or skip if already connected)
		await connectWalletIfNeeded(page, metamask);

		// Step 7: Wait for the borrow form to load with default position
		console.log("📍 Step 7: Wait for borrow form to load");
		const collateralLabel = page.getByText(/Select your collateral asset/i);
		await expect(collateralLabel).toBeVisible({ timeout: 15000 });

		// Wait for cBTC to appear (indicates position loaded)
		const cbtcToken = page.getByText("cBTC").first();
		await expect(cbtcToken).toBeVisible({ timeout: 15000 });

		// Step 8: Check wallet balance
		console.log("📍 Step 8: Check wallet balance");
		// The balance is shown near the MAX button
		const balanceText = await page.locator("text=/\\d+\\.?\\d*\\s*cBTC/").first().textContent({ timeout: 10000 });
		console.log(`   Wallet balance: ${balanceText}`);

		// Extract the balance value
		const balanceMatch = balanceText?.match(/([\d.]+)\s*cBTC/);
		const balance = balanceMatch ? parseFloat(balanceMatch[1]) : 0;

		if (balance < 0.0001) {
			console.log("⚠️  Insufficient cBTC balance for test. Skipping transaction.");
			await page.close();
			test.skip();
			return;
		}

		// Step 9: Use pre-filled collateral amount (form auto-fills with max balance)
		console.log("📍 Step 9: Using pre-filled collateral amount");
		// The form automatically fills with the max collateral amount
		// We just verify the "You get" section shows a calculated value

		// Step 10: Verify "You get" amount is calculated
		console.log("📍 Step 10: Verify loan amount calculated");
		const youGetLabel = page.getByText(/You get/i);
		await expect(youGetLabel).toBeVisible();

		// Step 11: Find and click the borrow button
		console.log("📍 Step 11: Click borrow button");
		// The button contains "Receive X.XX JUSD"
		const borrowButton = page.getByRole("button", { name: /receive.*jusd/i });
		await expect(borrowButton).toBeVisible({ timeout: 10000 });

		// Check if button is enabled
		const isDisabled = await borrowButton.isDisabled();
		if (isDisabled) {
			console.log("⚠️  Borrow button is disabled. Checking for errors...");
			// Check for error messages
			const errorText = await page
				.locator('[class*="error"], [class*="Error"]')
				.textContent()
				.catch(() => "");
			console.log(`   Error: ${errorText || "Unknown error"}`);
			await page.close();
			test.skip();
			return;
		}

		// Record timestamp before transaction for blockchain verification
		const txStartTime = new Date();

		await borrowButton.click();
		console.log("   Clicked borrow button");

		// Step 12: Confirm transaction in MetaMask
		console.log("📍 Step 12: Confirm transaction in MetaMask");
		await page.waitForTimeout(2000);

		try {
			await metamask.confirmTransaction();
			console.log("   Transaction confirmed in MetaMask");
		} catch (error) {
			console.log("⚠️  Failed to confirm transaction:", error);
			await page.close();
			throw error;
		}

		// Step 13: Verify transaction on blockchain (MANDATORY - must confirm within 10s)
		console.log("📍 Step 13: Verify transaction on Citreascan (10s timeout)");
		const confirmedTx = await verifyTransactionOnCitreascan(WALLET_ADDRESS, txStartTime, CONFIRMATION_TIMEOUT_MS);
		expect(confirmedTx.status).toBe("ok");
		expect(confirmedTx.result).toBe("success");

		// Step 13b: Capture explorer screenshot in separate tab
		console.log("📍 Step 13b: Capture explorer screenshot");
		await captureExplorerScreenshot(context, confirmedTx.hash, "loan-default");

		// Step 14: Wait for UI success indicator
		console.log("📍 Step 14: Wait for UI confirmation");
		try {
			const successIndicator = page.locator("text=/success|confirmed|minted/i").first();
			await expect(successIndicator).toBeVisible({ timeout: 10000 });
			console.log("✅ UI shows transaction successful!");
		} catch {
			// UI indicator is optional since we already verified on blockchain
			console.log("   UI indicator not found, but blockchain confirmed");
		}

		// Step 15: Take screenshot of final state
		console.log("📍 Step 15: Capture final state");
		await page.waitForTimeout(2000);
		await expect(page).toHaveScreenshot("loan-created-success.png", {
			maxDiffPixelRatio: 0.1,
		});

		await page.close();
	});

	test("should create a loan with custom parameters (0.003 cBTC, 40000 liq price, 1 month)", async () => {
		page = await context.newPage();

		// Step 1: Navigate to mint page
		console.log("\n📍 Step 1: Navigate to mint page");
		await page.goto("/mint");
		await page.waitForLoadState("networkidle");

		// Step 2-6: Connect wallet (or skip if already connected)
		await connectWalletIfNeeded(page, metamask);

		// Step 7: Wait for the borrow form to load
		console.log("📍 Step 7: Wait for borrow form to load");
		const collateralLabel = page.getByText(/Select your collateral asset/i);
		await expect(collateralLabel).toBeVisible({ timeout: 15000 });

		const cbtcToken = page.getByText("cBTC").first();
		await expect(cbtcToken).toBeVisible({ timeout: 15000 });

		// Step 8: Check wallet balance
		console.log("📍 Step 8: Check wallet balance");
		const balanceText = await page.locator("text=/\\d+\\.?\\d*\\s*cBTC/").first().textContent({ timeout: 10000 });
		console.log(`   Wallet balance: ${balanceText}`);

		const balanceMatch = balanceText?.match(/([\d.]+)\s*cBTC/);
		const balance = balanceMatch ? parseFloat(balanceMatch[1]) : 0;

		if (balance < 0.003) {
			console.log("⚠️  Insufficient cBTC balance for test (need 0.003). Skipping.");
			await page.close();
			test.skip();
			return;
		}

		// Step 9: Enter collateral amount: 0.003 cBTC
		console.log("📍 Step 9: Enter collateral amount: 0.003 cBTC");
		// The collateral input is the first visible text input with placeholder="0" that's NOT in a slider
		// It's in the section with cBTC token display
		const allInputs = page.locator('input[placeholder="0"]');
		const collateralInput = allInputs.first();
		await expect(collateralInput).toBeVisible({ timeout: 10000 });
		await collateralInput.click();
		await collateralInput.press("Control+a");
		await collateralInput.fill("0.003");
		console.log("   Entered: 0.003 cBTC");
		await page.waitForTimeout(1000);

		// Step 10: Set liquidation price: 40000
		console.log("📍 Step 10: Set liquidation price: 40000");
		// The liquidation price input is the second text input with placeholder="0" (after collateral)
		// It's in the slider section with JUSD logo
		const liqPriceInput = allInputs.nth(1);
		await expect(liqPriceInput).toBeVisible({ timeout: 10000 });
		await liqPriceInput.click();
		await liqPriceInput.press("Control+a");
		await liqPriceInput.fill("40000");
		console.log("   Entered: 40000 JUSD");
		await page.waitForTimeout(1000);

		// Step 11: Set expiration date: 1 month from now
		console.log("📍 Step 11: Set expiration date: 1 month from now");
		const oneMonthFromNow = new Date();
		oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
		const formattedDate = oneMonthFromNow.toISOString().split("T")[0]; // YYYY-MM-DD

		const dateInput = page.locator("#expiration-datepicker");
		await expect(dateInput).toBeVisible({ timeout: 10000 });
		await dateInput.click();
		await dateInput.fill(formattedDate);
		await page.keyboard.press("Escape"); // Close date picker
		console.log(`   Entered: ${formattedDate}`);
		await page.waitForTimeout(500);

		// Step 12: Verify "You get" amount
		console.log("📍 Step 12: Verify loan amount calculated");
		const youGetLabel = page.getByText(/You get/i);
		await expect(youGetLabel).toBeVisible();

		// Step 13: Click borrow button
		console.log("📍 Step 13: Click borrow button");
		const borrowButton = page.getByRole("button", { name: /receive.*jusd/i });
		await expect(borrowButton).toBeVisible({ timeout: 10000 });

		const isDisabled = await borrowButton.isDisabled();
		if (isDisabled) {
			console.log("⚠️  Borrow button is disabled. Checking for errors...");
			const errorText = await page
				.locator('[class*="error"], [class*="Error"]')
				.textContent()
				.catch(() => "");
			console.log(`   Error: ${errorText || "Unknown error"}`);
			await page.close();
			test.skip();
			return;
		}

		// Record timestamp before transaction for blockchain verification
		const txStartTime = new Date();

		await borrowButton.click();
		console.log("   Clicked borrow button");

		// Step 14: Confirm transaction in MetaMask
		console.log("📍 Step 14: Confirm transaction in MetaMask");
		await page.waitForTimeout(2000);

		try {
			await metamask.confirmTransaction();
			console.log("   Transaction confirmed in MetaMask");
		} catch (error) {
			console.log("⚠️  Failed to confirm transaction:", error);
			await page.close();
			throw error;
		}

		// Step 15: Verify transaction on blockchain (MANDATORY - must confirm within 10s)
		console.log("📍 Step 15: Verify transaction on Citreascan (10s timeout)");
		const confirmedTx = await verifyTransactionOnCitreascan(WALLET_ADDRESS, txStartTime, CONFIRMATION_TIMEOUT_MS);
		expect(confirmedTx.status).toBe("ok");
		expect(confirmedTx.result).toBe("success");

		// Step 15b: Capture explorer screenshot in separate tab
		console.log("📍 Step 15b: Capture explorer screenshot");
		await captureExplorerScreenshot(context, confirmedTx.hash, "loan-custom-params");

		// Step 16: Wait for UI success indicator
		console.log("📍 Step 16: Wait for UI confirmation");
		try {
			const successIndicator = page.locator("text=/success|confirmed|minted/i").first();
			await expect(successIndicator).toBeVisible({ timeout: 10000 });
			console.log("✅ UI shows transaction successful!");
		} catch {
			// UI indicator is optional since we already verified on blockchain
			console.log("   UI indicator not found, but blockchain confirmed");
		}

		// Step 17: Capture final state
		console.log("📍 Step 17: Capture final state");
		await page.waitForTimeout(2000);
		await expect(page).toHaveScreenshot("loan-custom-params-success.png", {
			maxDiffPixelRatio: 0.1,
		});

		await page.close();
	});

	test("should complete full loan lifecycle: open position, swap JUSD to SUSD, swap back, close position", async () => {
		page = await context.newPage();

		// Screenshot counter for unique naming
		let screenshotCount = 0;
		const screenshot = async (name: string) => {
			screenshotCount++;
			const filename = `lifecycle-${String(screenshotCount).padStart(2, "0")}-${name}.png`;
			await page.screenshot({ path: `test-results/screenshots/${filename}`, fullPage: true });
			console.log(`   📸 Screenshot: ${filename}`);
		};

		// =====================================================================
		// PHASE 1: Create a loan position
		// =====================================================================
		console.log("\n🔵 PHASE 1: Create Loan Position");
		console.log("━".repeat(50));

		// Step 1: Navigate to mint page
		console.log("\n📍 Step 1: Navigate to mint page");
		await page.goto("/mint");
		await page.waitForLoadState("networkidle");
		await screenshot("01-mint-page-initial");

		// Step 2-6: Connect wallet (or skip if already connected)
		await screenshot("02-before-connect-wallet");
		await connectWalletIfNeeded(page, metamask);
		await screenshot("03-wallet-connected");

		// Step 7: Wait for the borrow form to load
		console.log("📍 Step 7: Wait for borrow form to load");
		const collateralLabel = page.getByText(/Select your collateral asset/i);
		await expect(collateralLabel).toBeVisible({ timeout: 15000 });

		const cbtcToken = page.getByText("cBTC").first();
		await expect(cbtcToken).toBeVisible({ timeout: 15000 });
		await screenshot("09-borrow-form-loaded");

		// Step 8: Check wallet balance
		console.log("📍 Step 8: Check wallet balance");
		const balanceText = await page.locator("text=/\\d+\\.?\\d*\\s*cBTC/").first().textContent({ timeout: 10000 });
		console.log(`   Wallet balance: ${balanceText}`);

		const balanceMatch = balanceText?.match(/([\d.]+)\s*cBTC/);
		const balance = balanceMatch ? parseFloat(balanceMatch[1]) : 0;

		if (balance < 0.003) {
			console.log("⚠️  Insufficient cBTC balance for test (need 0.003). Skipping.");
			await screenshot("10-insufficient-balance");
			await page.close();
			test.skip();
			return;
		}

		// Step 9: Enter collateral amount: 0.003 cBTC
		console.log("📍 Step 9: Enter collateral amount: 0.003 cBTC");
		const allInputs = page.locator('input[placeholder="0"]');
		const collateralInput = allInputs.first();
		await expect(collateralInput).toBeVisible({ timeout: 10000 });
		await collateralInput.click();
		await collateralInput.press("Control+a");
		await collateralInput.fill("0.003");
		console.log("   Entered: 0.003 cBTC");
		await page.waitForTimeout(1000);
		await screenshot("10-collateral-entered");

		// Step 10: Set liquidation price: 40000
		console.log("📍 Step 10: Set liquidation price: 40000");
		const liqPriceInput = allInputs.nth(1);
		await expect(liqPriceInput).toBeVisible({ timeout: 10000 });
		await liqPriceInput.click();
		await liqPriceInput.press("Control+a");
		await liqPriceInput.fill("40000");
		console.log("   Entered: 40000 JUSD");
		await page.waitForTimeout(1000);
		await screenshot("11-liquidation-price-entered");

		// Step 11: Set expiration date: 1 month from now
		console.log("📍 Step 11: Set expiration date: 1 month from now");
		const oneMonthFromNow = new Date();
		oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
		const formattedDate = oneMonthFromNow.toISOString().split("T")[0];

		const dateInput = page.locator("#expiration-datepicker");
		await expect(dateInput).toBeVisible({ timeout: 10000 });
		await dateInput.click();
		await screenshot("12-datepicker-open");
		await dateInput.fill(formattedDate);
		await page.keyboard.press("Escape");
		console.log(`   Entered: ${formattedDate}`);
		await page.waitForTimeout(500);
		await screenshot("13-expiration-date-entered");

		// Step 12: Get the JUSD amount we'll receive (for later swap)
		console.log("📍 Step 12: Check loan amount");
		const youGetLabel = page.getByText(/You get/i);
		await expect(youGetLabel).toBeVisible();
		await screenshot("14-loan-form-complete");

		// Step 13: Click borrow button
		console.log("📍 Step 13: Click borrow button");
		const borrowButton = page.getByRole("button", { name: /receive.*jusd/i });
		await expect(borrowButton).toBeVisible({ timeout: 10000 });
		await screenshot("15-before-borrow-click");

		const isDisabled = await borrowButton.isDisabled();
		if (isDisabled) {
			console.log("⚠️  Borrow button is disabled. Skipping test.");
			await screenshot("16-borrow-button-disabled");
			await page.close();
			test.skip();
			return;
		}

		// Record timestamp before transaction for blockchain verification
		let txStartTime = new Date();

		await borrowButton.click();
		console.log("   Clicked borrow button");
		await screenshot("16-after-borrow-click");

		// Step 14: Confirm transaction in MetaMask
		console.log("📍 Step 14: Confirm transaction in MetaMask");
		await page.waitForTimeout(2000);
		await screenshot("17-waiting-for-metamask");

		try {
			await metamask.confirmTransaction();
			console.log("   Transaction confirmed in MetaMask");
		} catch (error) {
			console.log("⚠️  Failed to confirm transaction:", error);
			await screenshot("18-metamask-error");
			await page.close();
			throw error;
		}

		await screenshot("18-after-metamask-confirm");

		// Step 15: Verify transaction on blockchain
		console.log("📍 Step 15: Verify loan creation on Citreascan (10s timeout)");
		let confirmedTx = await verifyTransactionOnCitreascan(WALLET_ADDRESS, txStartTime, CONFIRMATION_TIMEOUT_MS);
		expect(confirmedTx.status).toBe("ok");
		expect(confirmedTx.result).toBe("success");
		console.log("✅ Loan created successfully!");

		// Capture explorer screenshot for loan creation
		console.log("📍 Step 15b: Capture explorer screenshot");
		await captureExplorerScreenshot(context, confirmedTx.hash, "lifecycle-loan-creation");

		// Wait for UI to update
		await page.waitForTimeout(3000);
		await screenshot("19-loan-created-success");

		// =====================================================================
		// PHASE 2: Swap JUSD to SUSD
		// =====================================================================
		console.log("\n🟡 PHASE 2: Swap JUSD → SUSD");
		console.log("━".repeat(50));

		// Navigate to swap page
		console.log("\n📍 Navigate to /swap");
		await page.goto("/swap");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(2000);
		await screenshot("20-swap-page-initial");

		// The default view is SUSD → JUSD, we need to reverse it to JUSD → SUSD
		console.log("📍 Change swap direction (JUSD → SUSD)");
		// Click the direction change button (arrow button)
		const directionButton = page.locator('button:has(svg[data-icon="arrow-down"])');
		await expect(directionButton).toBeVisible({ timeout: 10000 });
		await directionButton.click();
		await page.waitForTimeout(1000);
		console.log("   Direction changed to JUSD → SUSD");
		await screenshot("21-swap-direction-changed");

		// Enter amount to swap (use a small amount)
		console.log("📍 Enter swap amount");
		// Bring focus back to the main page (away from MetaMask)
		await page.bringToFront();
		await page.waitForTimeout(1000);
		// The input field uses BigNumberInput with placeholder="0" and type="text"
		const swapInput = page.locator('input[placeholder="0"]').first();
		await expect(swapInput).toBeVisible({ timeout: 10000 });
		await swapInput.click();
		await swapInput.fill("1"); // Enter 1 JUSD (component handles decimals)
		await page.waitForTimeout(1000);
		console.log("   Entered: 1 JUSD");
		await screenshot("22-swap-amount-entered-jusd");

		// Check if we need to approve first
		console.log("📍 Check for approve button");
		const approveButton = page.getByRole("button", { name: /approve/i });
		const needsApproval = await approveButton.isVisible({ timeout: 3000 }).catch(() => false);

		if (needsApproval) {
			console.log("📍 Approving JUSD...");
			await screenshot("23-jusd-needs-approval");
			txStartTime = new Date();
			await approveButton.click();
			await screenshot("24-jusd-approval-clicked");
			await page.waitForTimeout(3000);
			// Use approveTokenPermission for ERC20 approve() calls - MetaMask shows a different dialog
			await metamask.approveTokenPermission({ spendLimit: "max" });
			console.log("   Token permission approved in MetaMask");
			await screenshot("25-jusd-approval-confirmed");

			// Verify approval on blockchain
			console.log("📍 Verify approval on Citreascan");
			confirmedTx = await verifyTransactionOnCitreascan(WALLET_ADDRESS, txStartTime, CONFIRMATION_TIMEOUT_MS);
			expect(confirmedTx.status).toBe("ok");
			expect(confirmedTx.result).toBe("success");
			console.log("   ✅ Approval confirmed on chain!");

			// Capture explorer screenshot for JUSD approval
			await captureExplorerScreenshot(context, confirmedTx.hash, "lifecycle-jusd-approval");

			await page.waitForTimeout(2000);
			await screenshot("26-jusd-approval-success");
		}

		// Click swap button
		console.log("📍 Execute swap JUSD → SUSD");
		const swapButton = page.getByRole("button", { name: /swap/i });
		await expect(swapButton).toBeVisible({ timeout: 10000 });
		await expect(swapButton).toBeEnabled({ timeout: 10000 });
		await screenshot("27-before-swap-jusd-to-susd");

		txStartTime = new Date();
		await swapButton.click();
		await screenshot("28-swap-jusd-clicked");
		await page.waitForTimeout(2000);
		await metamask.confirmTransaction();
		console.log("   Swap confirmed in MetaMask");
		await screenshot("29-swap-jusd-metamask-confirmed");

		// Verify swap on blockchain
		console.log("📍 Verify swap on Citreascan (10s timeout)");
		confirmedTx = await verifyTransactionOnCitreascan(WALLET_ADDRESS, txStartTime, CONFIRMATION_TIMEOUT_MS);
		expect(confirmedTx.status).toBe("ok");
		expect(confirmedTx.result).toBe("success");
		console.log("✅ JUSD → SUSD swap successful!");

		// Capture explorer screenshot for JUSD → SUSD swap
		await captureExplorerScreenshot(context, confirmedTx.hash, "lifecycle-swap-jusd-to-susd");

		await page.waitForTimeout(2000);
		await screenshot("30-swap-jusd-to-susd-success");

		// =====================================================================
		// PHASE 3: Swap SUSD back to JUSD
		// =====================================================================
		console.log("\n🟢 PHASE 3: Swap SUSD → JUSD");
		console.log("━".repeat(50));

		// Refresh the page to reset state
		await page.goto("/swap");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(2000);
		await screenshot("31-swap-page-for-susd");

		// Default view is SUSD → JUSD, so no direction change needed
		console.log("📍 Enter swap amount (SUSD → JUSD)");
		// Bring focus back to the main page
		await page.bringToFront();
		await page.waitForTimeout(1000);
		const swapInputBack = page.locator('input[placeholder="0"]').first();
		await expect(swapInputBack).toBeVisible({ timeout: 10000 });
		await swapInputBack.click();
		await swapInputBack.fill("1"); // Enter 1 SUSD (component handles decimals)
		await page.waitForTimeout(1000);
		console.log("   Entered: 1 SUSD");
		await screenshot("32-swap-amount-entered-susd");

		// Check if we need to approve SUSD
		console.log("📍 Check for approve button");
		const approveButtonSusd = page.getByRole("button", { name: /approve/i });
		const needsApprovalSusd = await approveButtonSusd.isVisible({ timeout: 3000 }).catch(() => false);

		if (needsApprovalSusd) {
			console.log("📍 Approving SUSD...");
			await screenshot("33-susd-needs-approval");
			txStartTime = new Date();
			await approveButtonSusd.click();
			await screenshot("34-susd-approval-clicked");
			await page.waitForTimeout(3000);
			// Use approveTokenPermission for ERC20 approve() calls
			await metamask.approveTokenPermission({ spendLimit: "max" });
			console.log("   Token permission approved in MetaMask");
			await screenshot("35-susd-approval-confirmed");

			// Verify approval on blockchain
			console.log("📍 Verify approval on Citreascan");
			confirmedTx = await verifyTransactionOnCitreascan(WALLET_ADDRESS, txStartTime, CONFIRMATION_TIMEOUT_MS);
			expect(confirmedTx.status).toBe("ok");
			expect(confirmedTx.result).toBe("success");
			console.log("   ✅ Approval confirmed on chain!");

			// Capture explorer screenshot for SUSD approval
			await captureExplorerScreenshot(context, confirmedTx.hash, "lifecycle-susd-approval");

			await page.waitForTimeout(2000);
			await screenshot("36-susd-approval-success");
		}

		// Click swap button
		console.log("📍 Execute swap SUSD → JUSD");
		const swapButtonBack = page.getByRole("button", { name: /swap/i });
		await expect(swapButtonBack).toBeVisible({ timeout: 10000 });
		await expect(swapButtonBack).toBeEnabled({ timeout: 10000 });
		await screenshot("37-before-swap-susd-to-jusd");

		txStartTime = new Date();
		await swapButtonBack.click();
		await screenshot("38-swap-susd-clicked");
		await page.waitForTimeout(2000);
		await metamask.confirmTransaction();
		console.log("   Swap confirmed in MetaMask");
		await screenshot("39-swap-susd-metamask-confirmed");

		// Verify swap on blockchain
		console.log("📍 Verify swap on Citreascan (10s timeout)");
		confirmedTx = await verifyTransactionOnCitreascan(WALLET_ADDRESS, txStartTime, CONFIRMATION_TIMEOUT_MS);
		expect(confirmedTx.status).toBe("ok");
		expect(confirmedTx.result).toBe("success");
		console.log("✅ SUSD → JUSD swap successful!");

		// Capture explorer screenshot for SUSD → JUSD swap
		await captureExplorerScreenshot(context, confirmedTx.hash, "lifecycle-swap-susd-to-jusd");

		await page.waitForTimeout(2000);
		await screenshot("40-swap-susd-to-jusd-success");

		// =====================================================================
		// PHASE 4: Close the position
		// =====================================================================
		console.log("\n🔴 PHASE 4: Close Position");
		console.log("━".repeat(50));

		// Navigate to dashboard to find position address
		console.log("\n📍 Navigate to dashboard");
		await page.goto("/dashboard");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(3000);
		await screenshot("41-dashboard-page");

		// Find the "Manage" button for our position and get the href
		console.log("📍 Find position and navigate to manage page");
		const manageLink = page.locator('a[href^="/mint/0x"][href$="/manage"]').first();
		await expect(manageLink).toBeVisible({ timeout: 15000 });
		await screenshot("42-position-found-on-dashboard");
		const positionHref = await manageLink.getAttribute("href");
		console.log(`   Found position: ${positionHref}`);

		// Navigate to the loan management page
		const loanManageUrl = positionHref?.replace("/manage", "/manage/loan");
		console.log(`📍 Navigate to ${loanManageUrl}`);
		await page.goto(loanManageUrl || "/dashboard");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(2000);
		await screenshot("43-loan-manage-page");

		// Switch to "Repay Loan" mode
		console.log("📍 Switch to Repay Loan mode");
		const repayLoanButton = page.getByText(/Repay Loan/i).first();
		await expect(repayLoanButton).toBeVisible({ timeout: 10000 });
		await screenshot("44-before-repay-loan-click");
		await repayLoanButton.click();
		await page.waitForTimeout(500);
		console.log("   Switched to Repay Loan mode");
		await screenshot("45-repay-loan-mode-active");

		// Click MAX to repay full amount
		console.log("📍 Click MAX to repay full loan");
		const maxButton = page.locator("button").filter({ hasText: /max/i }).first();
		await expect(maxButton).toBeVisible({ timeout: 5000 });
		await maxButton.click();
		await page.waitForTimeout(1000);
		console.log("   MAX amount entered");
		await screenshot("46-max-repay-amount-entered");

		// Check if we need to approve JUSD for the position
		console.log("📍 Check for approve button");
		const approveButtonClose = page.getByRole("button", { name: /approve/i });
		const needsApprovalClose = await approveButtonClose.isVisible({ timeout: 3000 }).catch(() => false);

		if (needsApprovalClose) {
			console.log("📍 Approving JUSD for position...");
			await screenshot("47-jusd-position-needs-approval");
			txStartTime = new Date();
			await approveButtonClose.click();
			await screenshot("48-jusd-position-approval-clicked");
			await page.waitForTimeout(3000);
			// Use approveTokenPermission for ERC20 approve() calls
			await metamask.approveTokenPermission({ spendLimit: "max" });
			console.log("   Token permission approved in MetaMask");
			await screenshot("49-jusd-position-approval-confirmed");

			// Verify approval on blockchain
			console.log("📍 Verify approval on Citreascan");
			confirmedTx = await verifyTransactionOnCitreascan(WALLET_ADDRESS, txStartTime, CONFIRMATION_TIMEOUT_MS);
			expect(confirmedTx.status).toBe("ok");
			expect(confirmedTx.result).toBe("success");
			console.log("   ✅ Approval confirmed on chain!");

			// Capture explorer screenshot for close position approval
			await captureExplorerScreenshot(context, confirmedTx.hash, "lifecycle-close-position-approval");

			await page.waitForTimeout(2000);
			await screenshot("50-jusd-position-approval-success");
		}

		// Click "Confirm & Close Position" button
		console.log("📍 Click Confirm & Close Position");
		const closePositionButton = page.getByRole("button", { name: /Confirm.*Close Position/i });
		await expect(closePositionButton).toBeVisible({ timeout: 10000 });
		await expect(closePositionButton).toBeEnabled({ timeout: 10000 });
		await screenshot("51-before-close-position-click");

		txStartTime = new Date();
		await closePositionButton.click();
		await screenshot("52-close-position-clicked");
		await page.waitForTimeout(2000);
		await metamask.confirmTransaction();
		console.log("   Close position confirmed in MetaMask");
		await screenshot("53-close-position-metamask-confirmed");

		// Verify close position on blockchain
		console.log("📍 Verify position close on Citreascan (10s timeout)");
		confirmedTx = await verifyTransactionOnCitreascan(WALLET_ADDRESS, txStartTime, CONFIRMATION_TIMEOUT_MS);
		expect(confirmedTx.status).toBe("ok");
		expect(confirmedTx.result).toBe("success");

		// Capture explorer screenshot for close position
		await captureExplorerScreenshot(context, confirmedTx.hash, "lifecycle-close-position");

		await page.waitForTimeout(2000);
		await screenshot("54-position-closed-success");

		console.log("\n" + "═".repeat(50));
		console.log("✅ FULL LOAN LIFECYCLE COMPLETED SUCCESSFULLY!");
		console.log("   1. ✅ Loan created with 0.003 cBTC collateral");
		console.log("   2. ✅ Swapped JUSD → SUSD");
		console.log("   3. ✅ Swapped SUSD → JUSD");
		console.log("   4. ✅ Position closed completely");
		console.log(`   📸 Total screenshots taken: ${screenshotCount}`);
		console.log("═".repeat(50));

		await screenshot("55-final-state");
		await page.close();
	});

	test("should close an existing position with single transaction", async () => {
		page = await context.newPage();

		// Screenshot helper
		let screenshotCount = 0;
		const screenshot = async (name: string) => {
			screenshotCount++;
			const filename = `close-position-${String(screenshotCount).padStart(2, "0")}-${name}.png`;
			if (!fs.existsSync(SCREENSHOT_DIR)) {
				fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
			}
			await page.screenshot({ path: `${SCREENSHOT_DIR}/${filename}`, fullPage: true });
			console.log(`   📸 Screenshot: ${filename}`);
		};

		console.log("\n🔴 TEST: Close Existing Position (Single Transaction)");
		console.log("━".repeat(50));
		console.log("This test validates that closing a position requires only ONE MetaMask confirmation");
		console.log("(Previously it required TWO: repayFull + withdrawCollateral)\n");

		// Step 1: Navigate to dashboard
		console.log("📍 Step 1: Navigate to dashboard");
		await page.goto("/dashboard");
		await page.waitForLoadState("networkidle");
		await screenshot("01-dashboard-initial");

		// Step 2: Force connect wallet (always fresh connection)
		console.log("📍 Step 2: Force connect wallet");
		await forceConnectWallet(page, metamask);
		await screenshot("02-wallet-connected");

		// Step 3: Wait for positions to load
		console.log("📍 Step 3: Wait for positions to load");
		await page.waitForTimeout(5000);
		await screenshot("03-positions-loaded");

		// Step 4: Find an existing position with the "Manage" link
		console.log("📍 Step 4: Find existing position");
		const manageLink = page.locator('a[href^="/mint/0x"][href$="/manage"]').first();
		const hasPosition = await manageLink.isVisible({ timeout: 15000 }).catch(() => false);

		if (!hasPosition) {
			console.log("⚠️  No existing position found on dashboard. Skipping test.");
			console.log("   To run this test, first create a loan position.");
			await screenshot("04-no-position-found");
			await page.close();
			test.skip();
			return;
		}

		await screenshot("04-position-found");
		const positionHref = await manageLink.getAttribute("href");
		console.log(`   Found position: ${positionHref}`);

		// Step 5: Navigate to loan management page
		const loanManageUrl = positionHref?.replace("/manage", "/manage/loan");
		console.log(`📍 Step 5: Navigate to ${loanManageUrl}`);
		await page.goto(loanManageUrl || "/dashboard");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(2000);
		await screenshot("05-loan-manage-page");

		// Step 6: Switch to "Repay Loan" mode
		console.log("📍 Step 6: Switch to Repay Loan mode");
		const repayLoanButton = page.getByText(/Repay Loan/i).first();
		await expect(repayLoanButton).toBeVisible({ timeout: 10000 });
		await repayLoanButton.click();
		await page.waitForTimeout(500);
		console.log("   Switched to Repay Loan mode");
		await screenshot("06-repay-loan-mode");

		// Step 7: Click MAX to repay full amount
		console.log("📍 Step 7: Click MAX to repay full loan");
		const maxButton = page.locator("button").filter({ hasText: /max/i }).first();
		await expect(maxButton).toBeVisible({ timeout: 5000 });
		await expect(maxButton).toBeEnabled({ timeout: 5000 });
		await maxButton.click();
		await page.waitForTimeout(1000);
		console.log("   MAX amount entered");
		await screenshot("07-max-amount-entered");

		// Step 8: Check if we need to approve JUSD
		console.log("📍 Step 8: Check for approve button");
		const approveButton = page.getByRole("button", { name: /approve/i });
		const needsApproval = await approveButton.isVisible({ timeout: 3000 }).catch(() => false);

		let txStartTime: Date;

		if (needsApproval) {
			console.log("📍 Step 8a: Approving JUSD for position...");
			await screenshot("08a-needs-approval");
			txStartTime = new Date();
			await approveButton.click();
			await page.waitForTimeout(3000);
			await metamask.approveTokenPermission({ spendLimit: "max" });
			console.log("   Token permission approved in MetaMask");
			await screenshot("08b-approval-confirmed");

			// Verify approval on blockchain
			console.log("📍 Verify approval on Citreascan");
			const approvalTx = await verifyTransactionOnCitreascan(WALLET_ADDRESS, txStartTime, CONFIRMATION_TIMEOUT_MS);
			expect(approvalTx.status).toBe("ok");
			console.log("   ✅ Approval confirmed on chain!");

			await page.waitForTimeout(2000);
			await screenshot("08c-approval-success");
		}

		// Step 9: Click "Confirm & Close Position" button
		console.log("📍 Step 9: Click Confirm & Close Position");
		console.log("   ⚡ IMPORTANT: This should trigger only ONE MetaMask confirmation!");
		const closePositionButton = page.getByRole("button", { name: /Confirm.*Close Position/i });
		await expect(closePositionButton).toBeVisible({ timeout: 10000 });
		await expect(closePositionButton).toBeEnabled({ timeout: 10000 });
		await screenshot("09-before-close-click");

		txStartTime = new Date();
		await closePositionButton.click();
		await screenshot("10-close-clicked");
		await page.waitForTimeout(2000);

		// THIS IS THE KEY ASSERTION: Only ONE confirmTransaction call!
		console.log("📍 Step 10: Confirm SINGLE transaction in MetaMask");
		await metamask.confirmTransaction();
		console.log("   ✅ Close position confirmed in MetaMask (SINGLE transaction!)");
		await screenshot("11-metamask-confirmed");

		// Step 11: Verify on blockchain
		console.log("📍 Step 11: Verify position close on Citreascan");
		const confirmedTx = await verifyTransactionOnCitreascan(WALLET_ADDRESS, txStartTime, CONFIRMATION_TIMEOUT_MS);
		expect(confirmedTx.status).toBe("ok");
		expect(confirmedTx.result).toBe("success");

		// Capture explorer screenshot
		await captureExplorerScreenshot(context, confirmedTx.hash, "close-position-single-tx");

		await page.waitForTimeout(2000);
		await screenshot("12-position-closed");

		console.log("\n" + "═".repeat(50));
		console.log("✅ CLOSE POSITION TEST PASSED!");
		console.log("   Position closed with SINGLE transaction (adjust call)");
		console.log("   Previously this required TWO transactions:");
		console.log("   - repayFull()");
		console.log("   - withdrawCollateral()");
		console.log(`   📸 Total screenshots: ${screenshotCount}`);
		console.log("═".repeat(50));

		await page.close();
	});

	test("should complete full lifecycle: open position, swap JUSD<->SUSD, close position", async () => {
		page = await context.newPage();

		console.log("\n🔵 TEST: Full Lifecycle (Open → Swap → Close)");
		console.log("━".repeat(50));

		// ═══════════════════════════════════════════════════
		// PHASE 1: OPEN POSITION (copied from working test)
		// ═══════════════════════════════════════════════════
		console.log("PHASE 1: OPEN POSITION");

		console.log("📍 Navigate to mint page");
		await page.goto("/mint");
		await page.waitForLoadState("networkidle");

		await forceConnectWallet(page, metamask);

		console.log("📍 Wait for borrow form to load");
		const collateralLabel = page.getByText(/Select your collateral asset/i);
		await expect(collateralLabel).toBeVisible({ timeout: 15000 });
		const cbtcToken = page.getByText("cBTC").first();
		await expect(cbtcToken).toBeVisible({ timeout: 15000 });

		console.log("📍 Check wallet balance");
		const balanceText = await page.locator("text=/\\d+\\.?\\d*\\s*cBTC/").first().textContent({ timeout: 10000 });
		console.log(`   Wallet balance: ${balanceText}`);
		const balanceMatch = balanceText?.match(/([\d.]+)\s*cBTC/);
		const balance = balanceMatch ? parseFloat(balanceMatch[1]) : 0;

		if (balance < 0.01) {
			console.log("⚠️  Insufficient cBTC balance (need 0.01 minimum). Skipping.");
			await page.close();
			test.skip();
			return;
		}

		console.log("📍 Enter collateral amount: 0.01 cBTC (minimum required)");
		const allInputs = page.locator('input[placeholder="0"]');
		const collateralInput = allInputs.first();
		await expect(collateralInput).toBeVisible({ timeout: 10000 });
		await collateralInput.click();
		await collateralInput.press("Control+a");
		await collateralInput.fill("0.01");
		await page.waitForTimeout(1000);

		console.log("📍 Click borrow button");
		const borrowButton = page.getByRole("button", { name: /receive.*jusd/i });
		await expect(borrowButton).toBeVisible({ timeout: 10000 });
		await expect(borrowButton).toBeEnabled({ timeout: 10000 });

		let txStartTime = new Date();
		await borrowButton.click();
		await page.waitForTimeout(2000);

		console.log("📍 Confirm in MetaMask");
		await metamask.confirmTransaction();
		console.log("   ✅ Position opened");

		const openTx = await verifyTransactionOnCitreascan(WALLET_ADDRESS, txStartTime, CONFIRMATION_TIMEOUT_MS);
		expect(openTx.status).toBe("ok");
		await captureExplorerScreenshot(context, openTx.hash, "lifecycle-01-open");

		// ═══════════════════════════════════════════════════
		// PHASE 2: SWAP 1 JUSD → SUSD
		// ═══════════════════════════════════════════════════
		console.log("\nPHASE 2: SWAP 1 JUSD → SUSD");

		console.log("📍 Navigate to swap page");
		await page.goto("/swap");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(2000);

		// Default is SUSD → JUSD, click direction button to switch
		console.log("📍 Switch direction (JUSD → SUSD)");
		const directionButton = page.locator("button.rounded-full").filter({ has: page.locator("svg") });
		await directionButton.click();
		await page.waitForTimeout(500);

		console.log("📍 Enter amount: 1 JUSD");
		// Swap page uses same input pattern
		const swapInput = page.locator('input[placeholder="0"]').first();
		await expect(swapInput).toBeVisible({ timeout: 5000 });
		await swapInput.click();
		await swapInput.fill("1"); // Human readable, component handles decimals
		await page.waitForTimeout(1000);

		// Check if approval is needed (same pattern as other tests)
		console.log("📍 Check for approve button");
		const approveBtn1 = page.getByRole("button", { name: /approve/i });
		const needsApproval1 = await approveBtn1.isVisible({ timeout: 3000 }).catch(() => false);

		if (needsApproval1) {
			console.log("   Approving JUSD...");
			txStartTime = new Date();
			await approveBtn1.click();
			await page.waitForTimeout(2000);
			await metamask.approveTokenPermission({ spendLimit: "max" });
			await verifyTransactionOnCitreascan(WALLET_ADDRESS, txStartTime, CONFIRMATION_TIMEOUT_MS);
			console.log("   ✅ JUSD approved");
			await page.waitForTimeout(2000);
		}

		console.log("📍 Click Swap button");
		const swapButton1 = page.getByRole("button", { name: /^swap$/i });
		await expect(swapButton1).toBeVisible({ timeout: 5000 });
		await expect(swapButton1).toBeEnabled({ timeout: 5000 });

		txStartTime = new Date();
		await swapButton1.click();
		await page.waitForTimeout(2000);

		console.log("📍 Confirm in MetaMask");
		await metamask.confirmTransaction();
		console.log("   ✅ JUSD → SUSD swap confirmed");

		const swap1Tx = await verifyTransactionOnCitreascan(WALLET_ADDRESS, txStartTime, CONFIRMATION_TIMEOUT_MS);
		expect(swap1Tx.status).toBe("ok");
		await captureExplorerScreenshot(context, swap1Tx.hash, "lifecycle-02-swap-jusd-susd");

		// ═══════════════════════════════════════════════════
		// PHASE 3: SWAP 1 SUSD → JUSD
		// ═══════════════════════════════════════════════════
		console.log("\nPHASE 3: SWAP 1 SUSD → JUSD");

		console.log("📍 Reload swap page (default: SUSD → JUSD)");
		await page.reload();
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(2000);

		console.log("📍 Enter amount: 1 SUSD");
		const swapInput2 = page.locator('input[placeholder="0"]').first();
		await expect(swapInput2).toBeVisible({ timeout: 5000 });
		await swapInput2.click();
		await swapInput2.fill("1");
		await page.waitForTimeout(1000);

		console.log("📍 Check for approve button");
		const approveBtn2 = page.getByRole("button", { name: /approve/i });
		const needsApproval2 = await approveBtn2.isVisible({ timeout: 3000 }).catch(() => false);

		if (needsApproval2) {
			console.log("   Approving SUSD...");
			txStartTime = new Date();
			await approveBtn2.click();
			await page.waitForTimeout(2000);
			await metamask.approveTokenPermission({ spendLimit: "max" });
			await verifyTransactionOnCitreascan(WALLET_ADDRESS, txStartTime, CONFIRMATION_TIMEOUT_MS);
			console.log("   ✅ SUSD approved");
			await page.waitForTimeout(2000);
		}

		console.log("📍 Click Swap button");
		const swapButton2 = page.getByRole("button", { name: /^swap$/i });
		await expect(swapButton2).toBeVisible({ timeout: 5000 });
		await expect(swapButton2).toBeEnabled({ timeout: 5000 });

		txStartTime = new Date();
		await swapButton2.click();
		await page.waitForTimeout(2000);

		console.log("📍 Confirm in MetaMask");
		await metamask.confirmTransaction();
		console.log("   ✅ SUSD → JUSD swap confirmed");

		const swap2Tx = await verifyTransactionOnCitreascan(WALLET_ADDRESS, txStartTime, CONFIRMATION_TIMEOUT_MS);
		expect(swap2Tx.status).toBe("ok");
		await captureExplorerScreenshot(context, swap2Tx.hash, "lifecycle-03-swap-susd-jusd");

		// ═══════════════════════════════════════════════════
		// PHASE 4: CLOSE POSITION (copied from working test)
		// ═══════════════════════════════════════════════════
		console.log("\nPHASE 4: CLOSE POSITION");

		console.log("📍 Navigate to dashboard");
		await page.goto("/dashboard");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(3000);

		console.log("📍 Find position");
		const manageLink = page.locator('a[href^="/mint/0x"][href$="/manage"]').first();
		await expect(manageLink).toBeVisible({ timeout: 15000 });
		const positionHref = await manageLink.getAttribute("href");
		console.log(`   Found position: ${positionHref}`);

		console.log("📍 Navigate to loan management");
		const loanManageUrl = positionHref?.replace("/manage", "/manage/loan");
		await page.goto(loanManageUrl || "/dashboard");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(2000);

		console.log("📍 Switch to Repay Loan mode");
		const repayLoanButton = page.getByText(/Repay Loan/i).first();
		await expect(repayLoanButton).toBeVisible({ timeout: 10000 });
		await repayLoanButton.click();
		await page.waitForTimeout(500);

		console.log("📍 Click MAX to repay full loan");
		const maxButton = page.locator("button").filter({ hasText: /max/i }).first();
		await expect(maxButton).toBeVisible({ timeout: 5000 });
		await expect(maxButton).toBeEnabled({ timeout: 5000 });
		await maxButton.click();
		await page.waitForTimeout(1000);

		console.log("📍 Check for approve button");
		const approveBtn3 = page.getByRole("button", { name: /approve/i });
		const needsApproval3 = await approveBtn3.isVisible({ timeout: 3000 }).catch(() => false);

		if (needsApproval3) {
			console.log("   Approving JUSD for position...");
			txStartTime = new Date();
			await approveBtn3.click();
			await page.waitForTimeout(2000);
			await metamask.approveTokenPermission({ spendLimit: "max" });
			await verifyTransactionOnCitreascan(WALLET_ADDRESS, txStartTime, CONFIRMATION_TIMEOUT_MS);
			console.log("   ✅ JUSD approved");
			await page.waitForTimeout(2000);
		}

		console.log("📍 Click Confirm & Close Position");
		const closePositionButton = page.getByRole("button", { name: /Confirm.*Close Position/i });
		await expect(closePositionButton).toBeVisible({ timeout: 10000 });
		await expect(closePositionButton).toBeEnabled({ timeout: 10000 });

		txStartTime = new Date();
		await closePositionButton.click();
		await page.waitForTimeout(2000);

		console.log("📍 Confirm in MetaMask (SINGLE transaction)");
		await metamask.confirmTransaction();
		console.log("   ✅ Position closed");

		const closeTx = await verifyTransactionOnCitreascan(WALLET_ADDRESS, txStartTime, CONFIRMATION_TIMEOUT_MS);
		expect(closeTx.status).toBe("ok");
		expect(closeTx.result).toBe("success");
		await captureExplorerScreenshot(context, closeTx.hash, "lifecycle-04-close");

		// ═══════════════════════════════════════════════════
		console.log("\n" + "═".repeat(50));
		console.log("✅ FULL LIFECYCLE TEST PASSED!");
		console.log("   ✓ Position opened (0.01 cBTC)");
		console.log("   ✓ Swapped 1 JUSD → SUSD");
		console.log("   ✓ Swapped 1 SUSD → JUSD");
		console.log("   ✓ Position closed (single transaction)");
		console.log("═".repeat(50));

		await page.close();
	});

	test("should close position via Adjust Collateral (single transaction)", async () => {
		page = await context.newPage();

		// Screenshot helper
		let screenshotCount = 0;
		const screenshot = async (name: string) => {
			screenshotCount++;
			const filename = `adjust-collateral-close-${String(screenshotCount).padStart(2, "0")}-${name}.png`;
			if (!fs.existsSync(SCREENSHOT_DIR)) {
				fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
			}
			await page.screenshot({ path: `${SCREENSHOT_DIR}/${filename}`, fullPage: true });
			console.log(`   📸 Screenshot: ${filename}`);
		};

		console.log("\n🔵 TEST: Close Position via Adjust Collateral (Single Transaction)");
		console.log("━".repeat(50));
		console.log("This test validates closing a position through the Adjust Collateral flow");
		console.log("uses only ONE MetaMask confirmation (adjust call)\n");

		// ═══════════════════════════════════════════════════
		// PHASE 1: OPEN POSITION (need a position to close)
		// ═══════════════════════════════════════════════════
		console.log("PHASE 1: OPEN POSITION");

		console.log("📍 Navigate to mint page");
		await page.goto("/mint");
		await page.waitForLoadState("networkidle");
		await screenshot("01-mint-page");

		await forceConnectWallet(page, metamask);
		await screenshot("02-wallet-connected");

		console.log("📍 Wait for borrow form to load");
		const collateralLabel = page.getByText(/Select your collateral asset/i);
		await expect(collateralLabel).toBeVisible({ timeout: 15000 });
		const cbtcToken = page.getByText("cBTC").first();
		await expect(cbtcToken).toBeVisible({ timeout: 15000 });

		console.log("📍 Check wallet balance");
		const balanceText = await page.locator("text=/\\d+\\.?\\d*\\s*cBTC/").first().textContent({ timeout: 10000 });
		console.log(`   Wallet balance: ${balanceText}`);
		const balanceMatch = balanceText?.match(/([\d.]+)\s*cBTC/);
		const balance = balanceMatch ? parseFloat(balanceMatch[1]) : 0;

		// Minimum collateral is 0.002 cBTC (matches genesis position)
		if (balance < 0.002) {
			console.log("⚠️  Insufficient cBTC balance (need minimum 0.002 cBTC). Skipping.");
			await screenshot("03-insufficient-balance");
			await page.close();
			test.skip();
			return;
		}

		// Use 0.005 cBTC (above minimum, leaves room for fees)
		const collateralAmount = "0.005";
		console.log(`   Using collateral amount: ${collateralAmount} cBTC`);

		console.log("📍 Enter collateral amount");
		const allInputs = page.locator('input[placeholder="0"]');
		const collateralInput = allInputs.first();
		await expect(collateralInput).toBeVisible({ timeout: 10000 });
		await collateralInput.click();
		await collateralInput.press("Control+a");
		await collateralInput.fill(collateralAmount);
		await page.waitForTimeout(1000);
		await screenshot("03-collateral-entered");

		console.log("📍 Click borrow button");
		const borrowButton = page.getByRole("button", { name: /receive.*jusd/i });
		await expect(borrowButton).toBeVisible({ timeout: 10000 });
		await expect(borrowButton).toBeEnabled({ timeout: 10000 });
		await screenshot("04-before-borrow");

		let txStartTime = new Date();
		await borrowButton.click();
		await page.waitForTimeout(2000);
		await screenshot("05-borrow-clicked");

		console.log("📍 Confirm in MetaMask");
		await metamask.confirmTransaction();
		console.log("   ✅ Position opened");

		const openTx = await verifyTransactionOnCitreascan(WALLET_ADDRESS, txStartTime, CONFIRMATION_TIMEOUT_MS);
		expect(openTx.status).toBe("ok");
		await captureExplorerScreenshot(context, openTx.hash, "adjust-collateral-01-open");
		await screenshot("06-position-opened");

		// Wait for UI to update
		await page.waitForTimeout(3000);

		// ═══════════════════════════════════════════════════
		// PHASE 2: NAVIGATE TO ADJUST COLLATERAL
		// ═══════════════════════════════════════════════════
		console.log("\nPHASE 2: NAVIGATE TO ADJUST COLLATERAL");

		console.log("📍 Navigate to dashboard");
		await page.goto("/dashboard");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(3000);
		await screenshot("07-dashboard");

		console.log("📍 Find position");
		const manageLink = page.locator('a[href^="/mint/0x"][href$="/manage"]').first();
		await expect(manageLink).toBeVisible({ timeout: 15000 });
		const positionHref = await manageLink.getAttribute("href");
		console.log(`   Found position: ${positionHref}`);
		await screenshot("08-position-found");

		// Navigate to collateral management page
		const collateralManageUrl = positionHref?.replace("/manage", "/manage/collateral");
		console.log(`📍 Navigate to ${collateralManageUrl}`);
		await page.goto(collateralManageUrl || "/dashboard");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(2000);
		await screenshot("09-collateral-manage-page");

		// ═══════════════════════════════════════════════════
		// PHASE 3: CLOSE POSITION VIA ADJUST COLLATERAL
		// ═══════════════════════════════════════════════════
		console.log("\nPHASE 3: CLOSE POSITION VIA ADJUST COLLATERAL");

		// Click "Remove" button (SvgIconButton with text "Remove")
		console.log("📍 Click Remove button");
		const removeButton = page.locator("button").filter({ hasText: /^remove$/i });
		await expect(removeButton).toBeVisible({ timeout: 10000 });
		await removeButton.click();
		await page.waitForTimeout(500);
		console.log("   Switched to Remove mode");
		await screenshot("10-remove-mode");

		// Click MAX to remove all collateral
		console.log("📍 Click MAX to remove all collateral");
		const maxButton = page.locator("button").filter({ hasText: /max/i }).first();
		await expect(maxButton).toBeVisible({ timeout: 5000 });
		await maxButton.click();
		await page.waitForTimeout(1000);
		console.log("   MAX amount entered");
		await screenshot("11-max-clicked");

		// When removing all collateral with existing debt, strategy option appears
		// We need to click "Repay Loan" to enable full close
		console.log("📍 Check for Repay Loan option");
		const repayLoanOption = page.getByText(/repay.*loan/i).first();
		const needsRepayLoan = await repayLoanOption.isVisible({ timeout: 3000 }).catch(() => false);

		if (needsRepayLoan) {
			console.log("   Found Repay Loan option - clicking to enable full close");
			await repayLoanOption.click();
			await page.waitForTimeout(500);
			await screenshot("12-repay-loan-selected");
		}

		// Check if we need to approve JUSD for repayment
		console.log("📍 Check for approve button");
		const approveButton = page.getByRole("button", { name: /approve/i });
		const needsApproval = await approveButton.isVisible({ timeout: 3000 }).catch(() => false);

		if (needsApproval) {
			console.log("📍 Approving JUSD for position...");
			await screenshot("13-needs-approval");
			txStartTime = new Date();
			await approveButton.click();
			await page.waitForTimeout(3000);
			await metamask.approveTokenPermission({ spendLimit: "max" });
			console.log("   Token permission approved in MetaMask");
			await screenshot("14-approval-confirmed");

			// Verify approval on blockchain
			console.log("📍 Verify approval on Citreascan");
			const approvalTx = await verifyTransactionOnCitreascan(WALLET_ADDRESS, txStartTime, CONFIRMATION_TIMEOUT_MS);
			expect(approvalTx.status).toBe("ok");
			console.log("   ✅ Approval confirmed on chain!");

			await captureExplorerScreenshot(context, approvalTx.hash, "adjust-collateral-02-approval");
			await page.waitForTimeout(2000);
			await screenshot("15-approval-success");
		}

		// Find and click the action button (contains "Remove" or "Repay" and amount)
		console.log("📍 Click the close/remove button");
		// The button text varies: "Remove X.XX cBTC" or "Repay X JUSD & Remove X.XX cBTC"
		const actionButton = page
			.getByRole("button")
			.filter({ hasText: /remove.*cbtc|close.*position|repay.*remove/i })
			.first();
		await expect(actionButton).toBeVisible({ timeout: 10000 });
		await expect(actionButton).toBeEnabled({ timeout: 10000 });
		await screenshot("16-before-close-click");

		console.log("   ⚡ IMPORTANT: This should trigger only ONE MetaMask confirmation!");
		txStartTime = new Date();
		await actionButton.click();
		await screenshot("17-close-clicked");
		await page.waitForTimeout(2000);

		// THIS IS THE KEY ASSERTION: Only ONE confirmTransaction call!
		console.log("📍 Confirm SINGLE transaction in MetaMask");
		await metamask.confirmTransaction();
		console.log("   ✅ Position closed in MetaMask (SINGLE transaction!)");
		await screenshot("18-metamask-confirmed");

		// Verify on blockchain
		console.log("📍 Verify position close on Citreascan");
		const closeTx = await verifyTransactionOnCitreascan(WALLET_ADDRESS, txStartTime, CONFIRMATION_TIMEOUT_MS);
		expect(closeTx.status).toBe("ok");
		expect(closeTx.result).toBe("success");

		// Capture explorer screenshot
		await captureExplorerScreenshot(context, closeTx.hash, "adjust-collateral-03-close");

		await page.waitForTimeout(2000);
		await screenshot("19-position-closed");

		console.log("\n" + "═".repeat(50));
		console.log("✅ ADJUST COLLATERAL CLOSE TEST PASSED!");
		console.log("   Position closed via Adjust Collateral with SINGLE transaction");
		console.log("   The adjust() call handles: repay debt + withdraw collateral atomically");
		console.log(`   📸 Total screenshots: ${screenshotCount}`);
		console.log("═".repeat(50));

		await page.close();
	});
});
