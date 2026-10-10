export const E2E_ACCOUNT = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as const;
export const E2E_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
export const SANCTIONED_ACCOUNT = "0x983a81ca6FB1e441266D2FbcB7D8E530AC2E05A2" as const;

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL_MAINNET ?? "https://eth.llamarpc.com";

export const WHITELISTED = {
	wbtc: "0x8baA6d891c907E4EBa4b1b0Ef351cB678D50AE7F",
	weth: "0x23a7c7034C38d8ADFa7b10f42f93eEeb1AD83Ed5",
	cbbtc: "0x73553C3f2E5dc32e0e4b63EF127f205bD33d16B6",
} as const;

export const ROUTES = [
	"/dashboard",
	"/swap",
	"/mint",
	"/mint/create",
	"/savings",
	"/equity",
	"/coverage",
	"/governance",
	"/referrals",
	"/rates",
	"/monitoring",
	"/challenges",
	"/mypositions",
	"/ecosystem",
	"/minter-check",
] as const;

export const NAV_LABELS = {
	dashboard: "Dashboard",
	swap: "Swap",
	borrow: "Lending",
	savings: "Savings",
	equity: "Equity",
	referrals: "My Referrals",
} as const;
