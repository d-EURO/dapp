import { useReadContracts } from "wagmi";
import { decodeBigIntCall } from "@utils";
import { StablecoinBridgeABI } from "@deuro/eurocoin";
import { buildContractBatcher } from "../utils/contractBatcher";
import { StablecoinSymbol, SupportedStablecoin, useSupportedBridges } from "./useSupportedBridges";
import { WAGMI_CHAIN } from "../app.config";

export interface BridgeStat {
	symbol: StablecoinSymbol;
	bridgeAddress: SupportedStablecoin["bridgeAddress"];
	tokenAddress: SupportedStablecoin["address"];
	minted: bigint;
	limit: bigint;
	remaining: bigint;
	horizon: bigint;
	isExpired: boolean;
}

export interface BridgeStatsResult {
	bridges: BridgeStat[];
	totalBridgeMinted: bigint;
	isLoading: boolean;
}

export const useBridgeStats = (): BridgeStatsResult => {
	const chainId = WAGMI_CHAIN.id as number;
	const supportedStablecoins = useSupportedBridges();

	const contractBatcher = buildContractBatcher(
		supportedStablecoins
			.map((stablecoin) => [
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
			.flat()
	);

	const { data: contractBatcherData, isLoading } = useReadContracts({
		contracts: contractBatcher.getQuery(),
	});

	const parsedData = contractBatcherData ? contractBatcher.parseResponse(contractBatcherData) : {};

	const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));

	const bridges: BridgeStat[] = supportedStablecoins.map((stablecoin) => {
		const data = parsedData?.[stablecoin.address];
		const minted = decodeBigIntCall(data?.minted || 0);
		const limit = decodeBigIntCall(data?.limit || 0);
		const horizon = decodeBigIntCall(data?.horizon || 0);

		return {
			symbol: stablecoin.symbol,
			bridgeAddress: stablecoin.bridgeAddress,
			tokenAddress: stablecoin.address,
			minted,
			limit,
			remaining: limit - minted,
			horizon,
			isExpired: horizon > 0n && currentTimestamp > horizon,
		};
	});

	const totalBridgeMinted = bridges.reduce((sum, b) => sum + b.minted, 0n);

	return { bridges, totalBridgeMinted, isLoading };
};
