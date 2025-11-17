import { useAccount, useReadContracts } from "wagmi";
import { decodeBigIntCall } from "@utils";
import { Address, erc20Abi } from "viem";
import { WAGMI_CHAIN } from "../app.config";
import { ADDRESS, StablecoinBridgeABI } from "@juicedollar/jusd";

const getTokenContractBasics = (chainId: number, address: Address, account: Address, bridgeAddress: Address) => {
	return [
		{ // Balance of the user in the wallet
			chainId,
			address,
			abi: erc20Abi,
			functionName: "balanceOf",
			args: [account],
		},
		{ // Symbol of the token
			chainId,
			address,
			abi: erc20Abi,
			functionName: "symbol",
		},
		{ // Allowance of the user to the bridge
			chainId,
			address,
			abi: erc20Abi,
			functionName: "allowance",
			args: [account, bridgeAddress],
		},
		{ // Balance of the bridge
			chainId,
			address,
			abi: erc20Abi,
			functionName: "balanceOf",
			args: [bridgeAddress],
		},
		{ // Decimals of the token
			chainId,
			address,
			abi: erc20Abi,
			functionName: "decimals",
		},
		{ // Limit of the bridge
			chainId,
			address: bridgeAddress,
			abi: StablecoinBridgeABI,
			functionName: "limit",
		},
		{ // Minted coins of the bridge
			chainId,
			address: bridgeAddress,
			abi: StablecoinBridgeABI,
			functionName: "minted",
		},
	];
};

const parseStablecoinStats = (data: any, fromIndex: number) => {
	return {
		userBal: data ? decodeBigIntCall(data[fromIndex]) : BigInt(0),
		symbol: data ? String(data[fromIndex + 1].result) : "",
		userAllowance: data ? decodeBigIntCall(data[fromIndex + 2]) : BigInt(0),
		bridgeBal: data ? decodeBigIntCall(data[fromIndex + 3]) : BigInt(0),
		decimals: data ? decodeBigIntCall(data[fromIndex + 4]) : BigInt(0),
		limit: data ? decodeBigIntCall(data[fromIndex + 5]) : BigInt(0),
		minted: data ? decodeBigIntCall(data[fromIndex + 6]) : BigInt(0),
		remaining: data ? decodeBigIntCall(data[fromIndex + 5]) - decodeBigIntCall(data[fromIndex + 6]) : BigInt(0),
	}
}

export const useSwapStats = () => {
	const chainId = WAGMI_CHAIN.id as number;
	const { address } = useAccount();
	const account = address || "0x0";

	const { data, isError, isLoading, refetch } = useReadContracts({
		contracts: [
			// dEURO Calls
			{
				chainId,
				address: ADDRESS[chainId].juiceDollar,
				abi: erc20Abi,
				functionName: "balanceOf",
				args: [account],
			},
			{
				chainId,
				address: ADDRESS[chainId].juiceDollar,
				abi: erc20Abi,
				functionName: "symbol",
			},
			{
				chainId,
				address: ADDRESS[chainId].juiceDollar,
				abi: erc20Abi,
				functionName: "decimals",
			},
			{
				chainId,
				address: ADDRESS[chainId].juiceDollar,
				abi: erc20Abi,
				functionName: "allowance",
				args: [account, ADDRESS[chainId].bridgeStartUSD],
			},
			...getTokenContractBasics(chainId, ADDRESS[chainId].startUSD, account, ADDRESS[chainId].bridgeStartUSD),
		],
	});

	const dEuro = {
		userBal: data ? decodeBigIntCall(data[0]) : BigInt(0),
		symbol: data ? String(data[1].result) : "",
		decimals: data ? decodeBigIntCall(data[2]) : BigInt(0),
		bridgeAllowance: data ? decodeBigIntCall(data[3]) : BigInt(0),
		contractAddress: ADDRESS[chainId].juiceDollar,
	};

	const startUSD = {
		...parseStablecoinStats(data, 4),
		contractAddress: ADDRESS[chainId].startUSD,
		contractBridgeAddress: ADDRESS[chainId].bridgeStartUSD,
	};

	return {
		isError,
		isLoading,
		startUSD,
		dEuro,
		refetch,
	};
};
