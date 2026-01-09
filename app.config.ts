"use client";

import { ApolloClient, InMemoryCache, createHttpLink, from } from "@apollo/client";
import { onError } from "@apollo/client/link/error";
import { cookieStorage, createConfig, createStorage, http } from "@wagmi/core";
import { injected, coinbaseWallet, walletConnect } from "@wagmi/connectors";
import { testnet, mainnet } from "./chains";
import axios from "axios";
import { Address, Chain } from "viem";
import { TOKEN_SYMBOL } from "./utils/constant";

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

// DEV: Loaded with defaults, not needed for now.
// if (!process.env.NEXT_PUBLIC_WAGMI_ID) throw new Error("Project ID is not defined");
// if (!process.env.NEXT_PUBLIC_RPC_URL_MAINNET) throw new Error("RPC URL for at least mainnet, not available");
// if (process.env.NEXT_PUBLIC_CHAIN_NAME == "polygon" && !process.env.NEXT_PUBLIC_RPC_URL_POLYGON)
// throw new Error("RPC URL for polygon (testnet), not available");

// Config
export const CONFIG: ConfigEnv = {
	landing: "https://juicedollar.com",
	app: process.env.NEXT_PUBLIC_APP_URL ?? "",
	api: process.env.NEXT_PUBLIC_API_URL!,
	ponder: process.env.NEXT_PUBLIC_PONDER_URL!,
	ponderFallback: process.env.NEXT_PUBLIC_PONDER_FALLBACK_URL ?? process.env.NEXT_PUBLIC_PONDER_URL!,
	wagmiId: "b49c3a590c4407316a6fd6eae6531e90",
	chain: process.env.NEXT_PUBLIC_CHAIN_NAME ?? testnet.id.toString(),
	network: {
		mainnet: process.env.NEXT_PUBLIC_RPC_URL_MAINNET ?? "https://rpc.testnet.juiceswap.com/",
		testnet: process.env.NEXT_PUBLIC_RPC_URL_TESTNET ?? "https://rpc.testnet.juiceswap.com/",
	},
};

// CONFIG CHAIN
export const CONFIG_CHAIN = (): Chain => {
	return CONFIG.chain === "testnet" ? testnet : mainnet;
};

// CONFIG RPC
export const CONFIG_RPC = (): string => {
	return CONFIG.chain === "testnet" ? CONFIG.network.testnet : CONFIG.network.mainnet;
};

// Ponder fallback mechanism
let fallbackUntil: number | null = null;

function getPonderUrl(): string {
	return fallbackUntil && Date.now() < fallbackUntil ? CONFIG.ponderFallback : CONFIG.ponder;
}

function activateFallback(): void {
	if (!fallbackUntil) {
		fallbackUntil = Date.now() + 10 * 60 * 1000; // 10 minutes
		console.log("[Ponder] Switching to fallback for 10min:", CONFIG.ponderFallback);
	}
}

// PONDER CLIENT
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
	// Log GraphQL errors for better debugging
	if (graphQLErrors) {
		graphQLErrors.forEach((error) => {
			console.error(`[GraphQL error in operation: ${operation?.operationName || "unknown"}]`, {
				message: error.message,
				locations: error.locations,
				path: error.path,
			});
		});
	}

	if (!networkError || getPonderUrl() !== CONFIG.ponder) return;

	const is503 =
		(networkError as any)?.response?.status === 503 ||
		(networkError as any)?.statusCode === 503 ||
		(networkError as any)?.result?.status === 503;

	// Handle 503 Service Unavailable (Ponder syncing)
	if (is503) {
		console.log("[Ponder] 503 Service Unavailable - Ponder is syncing, switching to fallback");
		activateFallback();
		return forward(operation);
	}

	// Handle other network errors
	console.error(`[Network error in operation: ${operation?.operationName || "unknown"}]`, {
		message: (networkError as any).message,
		name: (networkError as any).name,
	});
	console.log("[Ponder] Network error detected, activating fallback");
	activateFallback();
	return forward(operation);
});

const httpLink = createHttpLink({
	uri: () => getPonderUrl(),
	// Add timeout protection for hanging requests
	fetchOptions: {
		timeout: 10000, // 10 second timeout
	},
});

export const PONDER_CLIENT = new ApolloClient({
	link: from([errorLink, httpLink]),
	cache: new InMemoryCache(),
});

// API CLIENT
export const API_CLIENT = axios.create({
	baseURL: CONFIG.api,
});

// WAGMI CONFIG
export const WAGMI_CHAIN = CONFIG_CHAIN();
export const WAGMI_METADATA = {
	name: TOKEN_SYMBOL,
	description: `${TOKEN_SYMBOL} Frontend Application`,
	url: CONFIG.landing,
	icons: ["https://avatars.githubusercontent.com/u/37784886"],
};
export const WAGMI_CONFIG = createConfig({
	chains: [testnet, mainnet] as const,
	transports: {
		[testnet.id]: http(CONFIG.network.testnet),
		[mainnet.id]: http(CONFIG.network.mainnet),
	},
	batch: {
		multicall: {
			wait: 200,
		},
	},
	connectors: [
		walletConnect({ projectId: CONFIG.wagmiId, metadata: WAGMI_METADATA, showQrModal: false }),
		injected({ shimDisconnect: true }),
		coinbaseWallet({
			appName: WAGMI_METADATA.name,
			appLogoUrl: WAGMI_METADATA.icons[0],
		}),
	],
	ssr: true,
	storage: createStorage({
		storage: cookieStorage,
	}),
});

// MINT POSITION BLACKLIST
export const MINT_POSITION_BLACKLIST: Address[] = [];
export const POSITION_NOT_BLACKLISTED = (addr: Address): boolean => {
	const r = MINT_POSITION_BLACKLIST.filter((p) => {
		return p.toLowerCase() === addr.toLowerCase();
	});
	return r.length == 0;
};
