import { defineChain } from 'viem';

export const testnet = defineChain({
	id: 5115,
	name: 'Testnet',
	nativeCurrency: { name: 'cBTC', symbol: 'cBTC', decimals: 18 },
	rpcUrls: {
		default: { http: ['https://rpc.testnet.citrea.xyz'] },
	},
	blockExplorers: {
		default: { name: 'Juice Explorer', url: 'https://explorer.testnet.citrea.xyz' },
	},
});

// Juice Mainnet - To define later, same as testnet for now
export const mainnet = defineChain({
	id: 62831,
	name: 'Mainnet',
	nativeCurrency: { name: 'cBTC', symbol: 'cBTC', decimals: 18 },
	rpcUrls: {
		default: { http: ['https://rpc.testnet.citrea.xyz'] },
	},
	blockExplorers: {
		default: { name: 'Juice Explorer', url: 'https://explorer.testnet.citrea.xyz' },
	},
});
