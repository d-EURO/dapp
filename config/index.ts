export * from "./chains";

export type ConfigEnv = {
	landing: string;
	app: string;
	api: string;
	ponder: string;
	ponderFallback: string;
	wagmiId: string;
	chain: string;
	network: {
		mainnet: string;
		testnet: string;
	};
};

export const CONFIG: ConfigEnv = {
	landing: "https://juicedollar.com",
	app: process.env.NEXT_PUBLIC_APP_URL!,
	api: process.env.NEXT_PUBLIC_API_URL!,
	ponder: process.env.NEXT_PUBLIC_PONDER_URL!,
	ponderFallback: process.env.NEXT_PUBLIC_PONDER_FALLBACK_URL || process.env.NEXT_PUBLIC_PONDER_URL!,
	wagmiId: "b49c3a590c4407316a6fd6eae6531e90",
	chain: process.env.NEXT_PUBLIC_CHAIN_NAME!,
	network: {
		mainnet: process.env.NEXT_PUBLIC_RPC_URL_MAINNET!,
		testnet: process.env.NEXT_PUBLIC_RPC_URL_TESTNET!,
	},
};
