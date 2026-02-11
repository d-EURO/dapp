"use client";

import type { NormalizedCacheObject } from "@apollo/client";
import { ApolloClient, InMemoryCache, createHttpLink, from } from "@apollo/client";
import { onError } from "@apollo/client/link/error";
import { cookieStorage, createConfig, createStorage, http } from "@wagmi/core";
import { injected, coinbaseWallet, walletConnect } from "@wagmi/connectors";
import { testnet, mainnet, CONFIG } from "@config";
import { Address, Chain } from "viem";
import { TOKEN_SYMBOL } from "./utils";

export type { ConfigEnv } from "@config";
export { CONFIG } from "@config";

// CONFIG CHAIN
export const CONFIG_CHAIN = (): Chain => {
	return CONFIG.chain === "testnet" ? testnet : mainnet;
};

// CONFIG RPC
export const CONFIG_RPC = (): string => {
	return CONFIG.chain === "testnet" ? CONFIG.network.testnet : CONFIG.network.mainnet;
};

const errorLink = onError(({ graphQLErrors, networkError }) => {
	if (graphQLErrors) {
		graphQLErrors.forEach((error) => {
			console.error(`[GraphQL error]`, {
				message: error.message,
				locations: error.locations,
				path: error.path,
			});
		});
	}
	if (networkError) {
		console.error(`[Network error]`, networkError);
	}
});

const ponderClientCache: Partial<Record<number, ApolloClient<NormalizedCacheObject>>> = {};

export function getPonderClient(chainId: number): ApolloClient<NormalizedCacheObject> {
	if (ponderClientCache[chainId]) return ponderClientCache[chainId]!;
	const ponderUrl = chainId === 4114 ? CONFIG.ponder.mainnet : CONFIG.ponder.testnet;
	const httpLink = createHttpLink({
		uri: ponderUrl,
		fetchOptions: { timeout: 10000 },
	});
	const client = new ApolloClient({
		link: from([errorLink, httpLink]),
		cache: new InMemoryCache(),
	});
	ponderClientCache[chainId] = client;
	return client;
}

// WAGMI CONFIG
export const WAGMI_CHAIN = CONFIG_CHAIN();
export const WAGMI_METADATA = {
	name: TOKEN_SYMBOL,
	description: `${TOKEN_SYMBOL} Frontend Application`,
	url: CONFIG.landing,
	icons: ["https://avatars.githubusercontent.com/u/37784886"],
};
export const WAGMI_CONFIG = createConfig({
	chains: [mainnet, testnet] as const,
	transports: {
		[mainnet.id]: http(CONFIG.network.mainnet),
		[testnet.id]: http(CONFIG.network.testnet),
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
