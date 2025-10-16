import { useAccount, useReadContracts } from "wagmi";
import { decodeBigIntCall } from "@utils";
import { Address, erc20Abi, maxUint256 } from "viem";
import { WAGMI_CHAIN } from "../app.config";
import { ADDRESS, StablecoinBridgeABI, SavingsVaultDEUROABI } from "@deuro/eurocoin";

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
			// Stablecoin Calls
			...getTokenContractBasics(chainId, ADDRESS[chainId].eurt, account, ADDRESS[chainId].bridgeEURT),
			...getTokenContractBasics(chainId, ADDRESS[chainId].eurc, account, ADDRESS[chainId].bridgeEURC),
			...getTokenContractBasics(chainId, ADDRESS[chainId].veur, account, ADDRESS[chainId].bridgeVEUR),
			...getTokenContractBasics(chainId, ADDRESS[chainId].eurs, account, ADDRESS[chainId].bridgeEURS),
			...getTokenContractBasics(chainId, ADDRESS[chainId].eura, account, ADDRESS[chainId].bridgeEURA),

			// dEURO Calls
			{
				chainId,
				address: ADDRESS[chainId].decentralizedEURO,
				abi: erc20Abi,
				functionName: "balanceOf",
				args: [account],
			},
			{
				chainId,
				address: ADDRESS[chainId].decentralizedEURO,
				abi: erc20Abi,
				functionName: "symbol",
			},
			{
				chainId,
				address: ADDRESS[chainId].decentralizedEURO,
				abi: erc20Abi,
				functionName: "decimals",
			},
			{
				chainId,
				address: ADDRESS[chainId].decentralizedEURO,
				abi: erc20Abi,
				functionName: "allowance",
				args: [account, ADDRESS[chainId].bridgeEURT],
			},
			{
				chainId,
				address: ADDRESS[chainId].decentralizedEURO,
				abi: erc20Abi,
				functionName: "allowance",
				args: [account, ADDRESS[chainId].bridgeEURC],
			},
			{
				chainId,
				address: ADDRESS[chainId].decentralizedEURO,
				abi: erc20Abi,
				functionName: "allowance",
				args: [account, ADDRESS[chainId].bridgeVEUR],
			},
			{
				chainId,
				address: ADDRESS[chainId].decentralizedEURO,
				abi: erc20Abi,
				functionName: "allowance",
				args: [account, ADDRESS[chainId].bridgeEURS],
			},
			{
				chainId,
				address: ADDRESS[chainId].decentralizedEURO,
				abi: erc20Abi,
				functionName: "allowance",
				args: [account, ADDRESS[chainId].bridgeEURR],
			},
			{
				chainId,
				address: ADDRESS[chainId].decentralizedEURO,
				abi: erc20Abi,
				functionName: "allowance",
				args: [account, ADDRESS[chainId].bridgeEUROP],
			},
			{
				chainId,
				address: ADDRESS[chainId].decentralizedEURO,
				abi: erc20Abi,
				functionName: "allowance",
				args: [account, ADDRESS[chainId].bridgeEURI],
			},
			{
				chainId,
				address: ADDRESS[chainId].decentralizedEURO,
				abi: erc20Abi,
				functionName: "allowance",
				args: [account, ADDRESS[chainId].bridgeEURE],
			},
			{
				chainId,
				address: ADDRESS[chainId].decentralizedEURO,
				abi: erc20Abi,
				functionName: "allowance",
				args: [account, ADDRESS[chainId].bridgeEURA],
			},
			{
				chainId,
				address: ADDRESS[chainId].decentralizedEURO,
				abi: erc20Abi,
				functionName: "allowance",
				args: [account, ADDRESS[chainId].savingsVaultDEURO],
			},
			...getTokenContractBasics(chainId, ADDRESS[chainId].eurr, account, ADDRESS[chainId].bridgeEURR),
			...getTokenContractBasics(chainId, ADDRESS[chainId].europ, account, ADDRESS[chainId].bridgeEUROP),
			...getTokenContractBasics(chainId, ADDRESS[chainId].euri, account, ADDRESS[chainId].bridgeEURI),
			...getTokenContractBasics(chainId, ADDRESS[chainId].eure, account, ADDRESS[chainId].bridgeEURE),

			// svdEURO Vault Calls
			{
				chainId,
				address: ADDRESS[chainId].savingsVaultDEURO,
				abi: erc20Abi,
				functionName: "balanceOf",
				args: [account],
			},
			{
				chainId,
				address: ADDRESS[chainId].savingsVaultDEURO,
				abi: erc20Abi,
				functionName: "symbol",
			},
			{
				chainId,
				address: ADDRESS[chainId].savingsVaultDEURO,
				abi: erc20Abi,
				functionName: "decimals",
			},
			{
				chainId,
				address: ADDRESS[chainId].savingsVaultDEURO,
				abi: SavingsVaultDEUROABI,
				functionName: "totalAssets",
			},
			{
				chainId,
				address: ADDRESS[chainId].savingsVaultDEURO,
				abi: SavingsVaultDEUROABI,
				functionName: "totalSupply",
			},
		],
	});

	const eurt = {
		...parseStablecoinStats(data, 0),
		contractAddress: ADDRESS[chainId].eurt,
		contractBridgeAddress: ADDRESS[chainId].bridgeEURT,
	};

	const eurc = {
		...parseStablecoinStats(data, 7),
		contractAddress: ADDRESS[chainId].eurc,
		contractBridgeAddress: ADDRESS[chainId].bridgeEURC,
	};

	const veur = {
		...parseStablecoinStats(data, 14),
		contractAddress: ADDRESS[chainId].veur,
		contractBridgeAddress: ADDRESS[chainId].bridgeVEUR,
	};

	const eurs = {
		...parseStablecoinStats(data, 21),
		contractAddress: ADDRESS[chainId].eurs,
		contractBridgeAddress: ADDRESS[chainId].bridgeEURS,
	};

	const eura = {
		...parseStablecoinStats(data, 28),
		contractAddress: ADDRESS[chainId].eura,
		contractBridgeAddress: ADDRESS[chainId].bridgeEURA,
	};

	const dEuro = {
		userBal: data ? decodeBigIntCall(data[35]) : BigInt(0),
		symbol: data ? String(data[36].result) : "",
		decimals: data ? decodeBigIntCall(data[37]) : BigInt(0),
		bridgeAllowance: {
			EURT: data ? decodeBigIntCall(data[38]) : BigInt(0),
			EURC: data ? decodeBigIntCall(data[39]) : BigInt(0),
			VEUR: data ? decodeBigIntCall(data[40]) : BigInt(0),
			EURS: data ? decodeBigIntCall(data[41]) : BigInt(0),
			EURR: data ? decodeBigIntCall(data[42]) : BigInt(0),
			EUROP: data ? decodeBigIntCall(data[43]) : BigInt(0),
			EURI: data ? decodeBigIntCall(data[44]) : BigInt(0),
			EURE: data ? decodeBigIntCall(data[45]) : BigInt(0),
			EURA: data ? decodeBigIntCall(data[46]) : BigInt(0),
			svdEURO: data ? decodeBigIntCall(data[47]) : BigInt(0),
		},
		contractAddress: ADDRESS[chainId].decentralizedEURO,
	};

	const eurr = {
		...parseStablecoinStats(data, 48),
		contractAddress: ADDRESS[chainId].eurr,
		contractBridgeAddress: ADDRESS[chainId].bridgeEURR,
	};

	const europ = {
		...parseStablecoinStats(data, 55),
		contractAddress: ADDRESS[chainId].europ,
		contractBridgeAddress: ADDRESS[chainId].bridgeEUROP,
	};

	const euri = {
		...parseStablecoinStats(data, 62),
		contractAddress: ADDRESS[chainId].euri,
		contractBridgeAddress: ADDRESS[chainId].bridgeEURI,
	};

	const eure = {
		...parseStablecoinStats(data, 69),
		contractAddress: ADDRESS[chainId].eure,
		contractBridgeAddress: ADDRESS[chainId].bridgeEURE,
	};

	const svdEURO = {
		userBal: data ? decodeBigIntCall(data[76]) : BigInt(0),
		symbol: data ? String(data[77].result) : "",
		userAllowance: maxUint256, // No approval needed for redeem when owner == msg.sender
		decimals: data ? decodeBigIntCall(data[78]) : BigInt(0),
		totalAssets: data ? decodeBigIntCall(data[79]) : BigInt(0),
		totalSupply: data ? decodeBigIntCall(data[80]) : BigInt(0),
		contractAddress: ADDRESS[chainId].savingsVaultDEURO,
		contractBridgeAddress: ADDRESS[chainId].savingsVaultDEURO, // Vault acts as its own "bridge"
		bridgeBal: BigInt(0),
		limit: BigInt(0),
		minted: BigInt(0),
		remaining: BigInt(0),
	};

	return {
		isError,
		isLoading,
		eurt,
		eurc,
		veur,
		eurs,
		eura,
		dEuro,
		eurr,
		europ,
		euri,
		eure,
		svdEURO,
		refetch,
	};
};
