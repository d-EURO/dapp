export * from "./chains";

export type ConfigEnv = {
	landing: string;
	app: string;
	api: {
		mainnet: string;
		testnet: string;
	};
	ponder: {
		mainnet: string;
		testnet: string;
	};
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
	api: {
		mainnet: process.env.NEXT_PUBLIC_API_URL_MAINNET!,
		testnet: process.env.NEXT_PUBLIC_API_URL_TESTNET!,
	},
	ponder: {
		mainnet: process.env.NEXT_PUBLIC_PONDER_URL_MAINNET!,
		testnet: process.env.NEXT_PUBLIC_PONDER_URL_TESTNET!,
	},
	wagmiId: "b49c3a590c4407316a6fd6eae6531e90",
	chain: process.env.NEXT_PUBLIC_CHAIN_NAME!,
	network: {
		mainnet: process.env.NEXT_PUBLIC_RPC_URL_MAINNET!,
		testnet: process.env.NEXT_PUBLIC_RPC_URL_TESTNET!,
	},
};
