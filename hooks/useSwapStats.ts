import { useAccount, useChainId, useReadContracts } from "wagmi";
import { decodeBigIntCall } from "@utils";
import { Address, erc20Abi } from "viem";
import { ADDRESS, StablecoinBridgeABI } from "@juicedollar/jusd";

const getTokenContractBasics = (chainId: number, address: Address, account: Address, bridgeAddress: Address) => {
	return [
		{
			// Balance of the user in the wallet
			chainId,
			address,
			abi: erc20Abi,
			functionName: "balanceOf",
			args: [account],
		},
		{
			// Symbol of the token
			chainId,
			address,
			abi: erc20Abi,
			functionName: "symbol",
		},
		{
			// Allowance of the user to the bridge
			chainId,
			address,
			abi: erc20Abi,
			functionName: "allowance",
			args: [account, bridgeAddress],
		},
		{
			// Balance of the bridge
			chainId,
			address,
			abi: erc20Abi,
			functionName: "balanceOf",
			args: [bridgeAddress],
		},
		{
			// Decimals of the token
			chainId,
			address,
			abi: erc20Abi,
			functionName: "decimals",
		},
		{
			// Limit of the bridge
			chainId,
			address: bridgeAddress,
			abi: StablecoinBridgeABI,
			functionName: "limit",
		},
		{
			// Minted coins of the bridge
			chainId,
			address: bridgeAddress,
			abi: StablecoinBridgeABI,
			functionName: "minted",
		},
	];
};

const parseStablecoinStats = (data: unknown[], fromIndex: number) => {
	const item1 = data[fromIndex + 1] as { result?: unknown } | undefined;
	return {
		userBal: data ? decodeBigIntCall(data[fromIndex]) : BigInt(0),
		symbol: item1?.result != null ? String(item1.result) : "",
		userAllowance: data ? decodeBigIntCall(data[fromIndex + 2]) : BigInt(0),
		bridgeBal: data ? decodeBigIntCall(data[fromIndex + 3]) : BigInt(0),
		decimals: data ? decodeBigIntCall(data[fromIndex + 4]) : BigInt(0),
		limit: data ? decodeBigIntCall(data[fromIndex + 5]) : BigInt(0),
		minted: data ? decodeBigIntCall(data[fromIndex + 6]) : BigInt(0),
		remaining: data ? decodeBigIntCall(data[fromIndex + 5]) - decodeBigIntCall(data[fromIndex + 6]) : BigInt(0),
	};
};

/** Bridge token entries derived from @juicedollar/jusd ADDRESS config for current chain */
function getBridgeEntries(chainId: number): { tokenAddress: Address; bridgeAddress: Address }[] {
	const addr = ADDRESS[chainId];
	if (!addr) return [];

	const potentialBridges = [
		{ token: "startUSD" as const, bridge: "bridgeStartUSD" as const },
		{ token: "USDC" as const, bridge: "bridgeUSDC" as const },
		{ token: "USDT" as const, bridge: "bridgeUSDT" as const },
		{ token: "CTUSD" as const, bridge: "bridgeCTUSD" as const },
	];

	return potentialBridges
		.filter(({ token, bridge }) => addr[token] && addr[bridge])
		.map(({ token, bridge }) => ({
			tokenAddress: addr[token] as Address,
			bridgeAddress: addr[bridge] as Address,
		}));
}

export type BridgeTokenStats = ReturnType<typeof parseStablecoinStats> & {
	contractAddress: Address;
	contractBridgeAddress: Address;
};

export const useSwapStats = () => {
	const chainId = useChainId();
	const { address } = useAccount();
	const account = (address || "0x0") as Address;

	const addr = ADDRESS[chainId];
	const bridgeEntries = addr ? getBridgeEntries(chainId) : [];

	const contracts =
		!addr || bridgeEntries.length === 0
			? []
			: [
					// JUSD base calls
					{ chainId, address: addr.juiceDollar, abi: erc20Abi, functionName: "balanceOf" as const, args: [account] },
					{ chainId, address: addr.juiceDollar, abi: erc20Abi, functionName: "symbol" as const },
					{ chainId, address: addr.juiceDollar, abi: erc20Abi, functionName: "decimals" as const },
					// JUSD allowance to each bridge (for burn flow)
					...bridgeEntries.map(({ bridgeAddress }) => ({
						chainId,
						address: addr.juiceDollar,
						abi: erc20Abi,
						functionName: "allowance" as const,
						args: [account, bridgeAddress],
					})),
					// Bridge token calls
					...bridgeEntries.flatMap(({ tokenAddress, bridgeAddress }) =>
						getTokenContractBasics(chainId, tokenAddress, account, bridgeAddress)
					),
			  ];

	const { data, isError, isLoading, refetch } = useReadContracts({
		contracts,
		query: { enabled: contracts.length > 0 },
	});

	const jusdBaseIndex = 0;
	const jusdAllowanceStartIndex = 3;
	const bridgeTokensStartIndex = 3 + bridgeEntries.length;

	const jusdData = {
		userBal: data && addr ? decodeBigIntCall(data[jusdBaseIndex]) : BigInt(0),
		symbol: data && addr ? String(data[jusdBaseIndex + 1].result) : "",
		decimals: data && addr ? decodeBigIntCall(data[jusdBaseIndex + 2]) : BigInt(0),
		contractAddress: (addr?.juiceDollar ?? "0x0") as Address,
		bridgeAllowances: bridgeEntries.reduce<Record<string, bigint>>((acc, { bridgeAddress }, i) => {
			acc[bridgeAddress] = data ? decodeBigIntCall(data[jusdAllowanceStartIndex + i]) : BigInt(0);
			return acc;
		}, {}),
	};

	const bridgeTokens: Record<string, BridgeTokenStats> = {};
	bridgeEntries.forEach(({ tokenAddress, bridgeAddress }, i) => {
		const fromIndex = bridgeTokensStartIndex + i * 7;
		const stats = parseStablecoinStats(data ?? [], fromIndex);
		// Key by chain symbol (e.g. SUSD, USDC.e, USDT.e, ctUSD)
		if (stats.symbol) {
			bridgeTokens[stats.symbol] = {
				...stats,
				contractAddress: tokenAddress,
				contractBridgeAddress: bridgeAddress,
			};
		}
	});

	return {
		isError,
		isLoading,
		jusdData,
		bridgeTokens,
		refetch,
	};
};
