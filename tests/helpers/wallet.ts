import { Page } from "@playwright/test";
import { E2E_ACCOUNT, RPC_URL, SANCTIONED_ACCOUNT } from "./constants";

const BALANCE_OF = "0x70a08231";
const ALLOWANCE = "0xdd62ed3e";
const DECIMALS = "0x313ce567";
const SYMBOL = "0x95d89b41";
const NAME = "0x06fdde03";

type JsonRpc = { method: string; params?: unknown[] };

async function nodeRpc(method: string, params: unknown[] = []): Promise<unknown> {
	const response = await fetch(RPC_URL, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
	});
	const body = (await response.json()) as { result?: unknown; error?: { message: string } };
	if (body.error) throw new Error(body.error.message);
	return body.result;
}

function maxUint(): string {
	return "0x" + "f".repeat(64);
}

function encodeUint(n: bigint): string {
	return "0x" + n.toString(16).padStart(64, "0");
}

export type WalletOptions = {
	account?: string;
	chainId?: string;
	fakeTokenBalance?: boolean;
	allowance?: bigint;
};

export async function installMockWallet(page: Page, options: WalletOptions = {}): Promise<void> {
	const account = (options.account ?? E2E_ACCOUNT).toLowerCase();
	const chainId = options.chainId ?? "0x1";
	const fakeTokenBalance = options.fakeTokenBalance ?? true;
	const allowance = options.allowance ?? 0n;

	await page.exposeFunction("__e2eRpc", async (payload: JsonRpc) => {
		const method = payload.method;
		const params = (payload.params ?? []) as unknown[];

		if (method === "eth_call") {
			const tx = (params[0] ?? {}) as { data?: string; to?: string };
			const data = (tx.data ?? "").toLowerCase();
			if (fakeTokenBalance && data.startsWith(BALANCE_OF)) return maxUint();
			if (data.startsWith(ALLOWANCE)) return encodeUint(allowance);
			if (data.startsWith(DECIMALS)) return encodeUint(18n);
		}

		return nodeRpc(method, params);
	});

	await page.addInitScript(
		({ account, chainId }) => {
			const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
			const emit = (event: string, ...args: unknown[]) => {
				(listeners[event] ?? []).forEach((cb) => cb(...args));
			};

			const provider = {
				isMetaMask: true,
				isConnected: () => true,
				chainId,
				networkVersion: "1",
				selectedAddress: account,
				request: async ({ method, params }: { method: string; params?: unknown[] }) => {
					if (method === "eth_requestAccounts" || method === "eth_accounts") return [account];
					if (method === "eth_chainId") return chainId;
					if (method === "net_version") return "1";
					if (method === "wallet_switchEthereumChain") return null;
					if (method === "wallet_addEthereumChain") return null;
					if (method === "wallet_requestPermissions") return [{ parentCapability: "eth_accounts" }];
					if (method === "wallet_getPermissions") return [{ parentCapability: "eth_accounts" }];
					if (method === "personal_sign" || method === "eth_sign") return "0x" + "ab".repeat(65);
					if (method === "eth_signTypedData_v4" || method === "eth_signTypedData") return "0x" + "ab".repeat(65);
					if (method === "eth_sendTransaction") {
						(window as unknown as { __e2eTxs: unknown[] }).__e2eTxs = [
							...((window as unknown as { __e2eTxs?: unknown[] }).__e2eTxs ?? []),
							params?.[0],
						];
						return "0x" + "11".repeat(32);
					}
					if (method === "eth_getTransactionReceipt") {
						return {
							transactionHash: params?.[0],
							status: "0x1",
							blockNumber: "0x1",
							logs: [],
						};
					}
					if (method === "eth_blockNumber") return "0x1";
					if (method === "eth_getBalance") return "0x" + (10n ** 24n).toString(16);
					if (method === "eth_estimateGas") return "0x5208";
					if (method === "eth_gasPrice") return "0x3b9aca00";
					if (method === "eth_maxPriorityFeePerGas") return "0x3b9aca00";
					if (method === "eth_feeHistory") {
						return { oldestBlock: "0x1", baseFeePerGas: ["0x3b9aca00"], gasUsedRatio: [0.5], reward: [["0x1"]] };
					}
					return (window as unknown as { __e2eRpc: (p: JsonRpc) => Promise<unknown> }).__e2eRpc({ method, params });
				},
				on: (event: string, cb: (...args: unknown[]) => void) => {
					listeners[event] = listeners[event] ?? [];
					listeners[event].push(cb);
				},
				removeListener: (event: string, cb: (...args: unknown[]) => void) => {
					listeners[event] = (listeners[event] ?? []).filter((x) => x !== cb);
				},
				emit,
			};

			Object.defineProperty(window, "ethereum", { value: provider, configurable: true, writable: true });
			(window as unknown as { __e2eTxs: unknown[] }).__e2eTxs = [];
			(window as unknown as { __e2eAccount: string }).__e2eAccount = account;
		},
		{ account, chainId },
	);
}

export async function installSanctionedWallet(page: Page): Promise<void> {
	await installMockWallet(page, { account: SANCTIONED_ACCOUNT, fakeTokenBalance: false });
}

export async function connectWallet(page: Page): Promise<void> {
	const connect = page.getByRole("button", { name: /connect wallet/i }).first();
	if (await connect.isVisible().catch(() => false)) {
		await connect.click();
		const candidates = [
			page.getByText("MetaMask", { exact: false }).first(),
			page.getByText("Browser Wallet", { exact: false }).first(),
			page.getByText("Injected", { exact: false }).first(),
			page.locator("w3m-modal").getByText("MetaMask").first(),
		];
		for (const candidate of candidates) {
			if (await candidate.isVisible({ timeout: 2500 }).catch(() => false)) {
				await candidate.click();
				break;
			}
		}
	}

	await page.waitForTimeout(500);
}

export async function sentTransactions(page: Page): Promise<unknown[]> {
	return page.evaluate(() => (window as unknown as { __e2eTxs?: unknown[] }).__e2eTxs ?? []);
}
