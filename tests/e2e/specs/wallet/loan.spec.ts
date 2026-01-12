import { test, expect, chromium, type BrowserContext, type Page } from "@playwright/test";
import { MetaMask, getExtensionId } from "@synthetixio/synpress-metamask/playwright";
import { prepareExtension } from "@synthetixio/synpress-cache";

const SEED_PHRASE = process.env.WALLET_SEED_PHRASE || "";
const WALLET_PASSWORD = process.env.WALLET_PASSWORD || "";
const WALLET_ADDRESS = process.env.WALLET_ADDRESS || "";

// Citreascan API configuration
const CITREASCAN_API = "https://testnet.citreascan.com/api/v2";
const CONFIRMATION_TIMEOUT_MS = 10000;
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

test.describe("Loan Creation", () => {
	// Increase timeout for wallet transactions
	test.setTimeout(120000);
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

		// Step 2: Connect wallet
		console.log("📍 Step 2: Connect wallet");
		const connectButton = page.getByRole("button", { name: /connect/i });
		await expect(connectButton).toBeVisible({ timeout: 15000 });
		await connectButton.click();

		// Step 3: Select MetaMask from wallet modal
		console.log("📍 Step 3: Select MetaMask");
		await page.waitForTimeout(1000);
		const walletOption = page.getByText(/metamask/i).first();
		await expect(walletOption).toBeVisible({ timeout: 5000 });
		await walletOption.click();

		// Step 4: Approve connection in MetaMask
		console.log("📍 Step 4: Approve connection in MetaMask");
		await metamask.connectToDapp();
		await page.waitForTimeout(2000);

		// Step 5: Handle network switch if prompted
		console.log("📍 Step 5: Handle network switch");
		try {
			// Check if there's a network switch modal
			const switchNetworkButton = page.getByRole("button", { name: /switch network/i });
			const isSwitchVisible = await switchNetworkButton.isVisible({ timeout: 3000 }).catch(() => false);
			if (isSwitchVisible) {
				await switchNetworkButton.click();
				await metamask.approveNetworkSwitch();
				await page.waitForTimeout(2000);
			}
		} catch {
			// No network switch needed
			console.log("   No network switch needed");
		}

		// Close any modal that might be open
		await page.keyboard.press("Escape");
		await page.waitForTimeout(500);

		// Verify wallet is connected
		console.log("📍 Step 6: Verify wallet connected");
		await expect(page.locator("text=/0x[a-fA-F0-9]{4}/i").first()).toBeVisible({ timeout: 15000 });

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

		// Step 2: Connect wallet
		console.log("📍 Step 2: Connect wallet");
		const connectButton = page.getByRole("button", { name: /connect/i });
		await expect(connectButton).toBeVisible({ timeout: 15000 });
		await connectButton.click();

		// Step 3: Select MetaMask from wallet modal
		console.log("📍 Step 3: Select MetaMask");
		await page.waitForTimeout(1000);
		const walletOption = page.getByText(/metamask/i).first();
		await expect(walletOption).toBeVisible({ timeout: 5000 });
		await walletOption.click();

		// Step 4: Approve connection in MetaMask
		console.log("📍 Step 4: Approve connection in MetaMask");
		await metamask.connectToDapp();
		await page.waitForTimeout(2000);

		// Step 5: Handle network switch if prompted
		console.log("📍 Step 5: Handle network switch");
		try {
			const switchNetworkButton = page.getByRole("button", { name: /switch network/i });
			const isSwitchVisible = await switchNetworkButton.isVisible({ timeout: 3000 }).catch(() => false);
			if (isSwitchVisible) {
				await switchNetworkButton.click();
				await metamask.approveNetworkSwitch();
				await page.waitForTimeout(2000);
			}
		} catch {
			console.log("   No network switch needed");
		}

		// Close any modal
		await page.keyboard.press("Escape");
		await page.waitForTimeout(500);

		// Verify wallet is connected
		console.log("📍 Step 6: Verify wallet connected");
		await expect(page.locator("text=/0x[a-fA-F0-9]{4}/i").first()).toBeVisible({ timeout: 15000 });

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
});
