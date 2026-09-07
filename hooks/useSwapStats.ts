import { useAccount, useReadContracts } from "wagmi";
import { decodeBigIntCall, decodeStringCall } from "@utils";
import { Address, erc20Abi } from "viem";
import { WAGMI_CHAIN } from "../app.config";
import { ADDRESS, StablecoinBridgeABI } from "@deuro/eurocoin";
import { buildContractBatcher } from "../utils/contractBatcher";
import { selectBurnBridge } from "../utils/selectBurnBridge";
import { StablecoinSymbol, SupportedStablecoin, useSupportedBridges } from "./useSupportedBridges";

type DEuroBridgeAllowance = {
	[key in StablecoinSymbol]?: bigint;
};
interface DEuroStats {
	userBal: bigint;
	symbol: string;
	decimals: bigint;
	bridgeAllowance: DEuroBridgeAllowance;
	contractAddress: Address;
}
interface StablecoinStats {
	userBal: bigint;
	symbol: string;
	userAllowance: bigint;
	bridgeBal: bigint;
	decimals: bigint;
	limit: bigint;
	minted: bigint;
	remaining: bigint;
	contractBridgeAddress: Address;
	burnBridgeAddress: Address;
	contractAddress: Address;
	horizon: bigint;
	isExpired: boolean;
}

export type StablecoinsStats = {
	[key in StablecoinSymbol]: StablecoinStats;
};
interface SwapStats extends StablecoinsStats {
	supportedStablecoins: SupportedStablecoin[];
	isError: boolean;
	isLoading: boolean;
	dEuro: DEuroStats;
	refetch: () => void;
}

const parseStablecoinStats = (data?: any): {
	userBal: bigint;
	symbol: string;
	userAllowance: bigint;
	decimals: bigint;
	limit: bigint;
	minted: bigint;
	remaining: bigint;
	horizon: bigint;
	isExpired: boolean;
} => {
	const horizon = data ? decodeBigIntCall(data?.horizon || 0) : BigInt(0);
	const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
	
	return {
		userBal: decodeBigIntCall(data?.balanceOf?.userBalance || 0),
		symbol: decodeStringCall(data?.symbol ?? ""),
		userAllowance: decodeBigIntCall(data?.allowance || 0),
		decimals: decodeBigIntCall(data?.decimals || 0),
		limit: decodeBigIntCall(data?.limit || 0),
		minted: decodeBigIntCall(data?.minted || 0),
		remaining: decodeBigIntCall(data?.limit || 0) - decodeBigIntCall(data?.minted || 0),
		isExpired: horizon > 0n && currentTimestamp > horizon,
		horizon: horizon,
	};
};

export const useSwapStats = (): SwapStats => {
	const chainId = WAGMI_CHAIN.id as number;
	const { address } = useAccount();
	const account = address || "0x0";
	const supportedStablecoins = useSupportedBridges();

	const contractBatcher = buildContractBatcher([
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
			calls: supportedStablecoins.flatMap((stablecoin) =>
				stablecoin.burnBridgeAddresses.map((burnAddress) => ({
					id: `${stablecoin.symbol}:${burnAddress}`,
					args: [account, burnAddress],
				}))
			),
		},
		...supportedStablecoins
			.map((stablecoin) => [
				{
					chainId,
					address: stablecoin.address,
					abi: erc20Abi,
					functionName: "balanceOf",
					calls: [
						{
							id: "userBalance",
							args: [account],
						},
						...stablecoin.burnBridgeAddresses.map((burnAddress) => ({
							id: burnAddress,
							args: [burnAddress],
						})),
					],
				},
				{
					chainId,
					address: stablecoin.address,
					abi: erc20Abi,
					functionName: "symbol",
				},
				{
					chainId,
					address: stablecoin.address,
					abi: erc20Abi,
					functionName: "allowance",
					args: [account, stablecoin.bridgeAddress],
				},
				{
					chainId,
					address: stablecoin.address,
					abi: erc20Abi,
					functionName: "decimals",
				},
				{
					chainId,
					address: stablecoin.bridgeAddress,
					groupKey: stablecoin.address,
					abi: StablecoinBridgeABI,
					functionName: "limit",
				},
				{
					chainId,
					address: stablecoin.bridgeAddress,
					groupKey: stablecoin.address,
					abi: StablecoinBridgeABI,
					functionName: "minted",
				},
				{
					chainId,
					address: stablecoin.bridgeAddress,
					groupKey: stablecoin.address,
					abi: StablecoinBridgeABI,
					functionName: "horizon",
				},
			])
			.flat(),
	]);

	const {
		data: contractBatcherData,
		isError,
		isLoading,
		refetch,
	} = useReadContracts({
		contracts: contractBatcher.getQuery(),
	});

	const parsedData = contractBatcherData ? contractBatcher.parseResponse(contractBatcherData) : {};

	const deuroAddress = ADDRESS[chainId].decentralizedEURO;

	const stablecoinsStats = supportedStablecoins.reduce((acc, stablecoin) => {
		const selectedBurn = selectBurnBridge(
			stablecoin.burnBridgeAddresses.map((address) => ({
				address,
				balance: decodeBigIntCall(parsedData?.[stablecoin.address]?.balanceOf?.[address] || 0),
			}))
		);

		return {
			...acc,
			[stablecoin.symbol]: {
				...parseStablecoinStats(parsedData?.[stablecoin.address]),
				bridgeBal: selectedBurn.balance,
				contractAddress: stablecoin.address,
				contractBridgeAddress: stablecoin.bridgeAddress,
				burnBridgeAddress: selectedBurn.address,
			},
		};
	}, {} as StablecoinsStats);

	const bridgeAllowance = supportedStablecoins.reduce(
		(acc, stablecoin) => ({
			...acc,
			[stablecoin.symbol]: decodeBigIntCall(
				parsedData?.[deuroAddress]?.allowance?.[`${stablecoin.symbol}:${stablecoinsStats[stablecoin.symbol].burnBridgeAddress}`] || 0
			),
		}),
		{}
	);

	const dEuro: DEuroStats = {
		userBal: decodeBigIntCall(parsedData?.[deuroAddress]?.balanceOf || 0) ?? BigInt(0),
		symbol: decodeStringCall(parsedData?.[deuroAddress]?.symbol ?? ""),
		decimals: decodeBigIntCall(parsedData?.[deuroAddress]?.decimals || 0),
		bridgeAllowance,
		contractAddress: ADDRESS[chainId].decentralizedEURO,
	};

	return {
		...stablecoinsStats,
		supportedStablecoins,
		isError,
		isLoading,
		dEuro,
		refetch,
	};
};
