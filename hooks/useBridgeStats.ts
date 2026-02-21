import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useReadContracts } from "wagmi";
import { decodeBigIntCall } from "@utils";
import { StablecoinBridgeABI } from "@deuro/eurocoin";
import { Address } from "viem";
import { RootState } from "../redux/redux.store";
import { WAGMI_CHAIN } from "../app.config";

export interface BridgeStat {
	symbol: string;
	bridgeAddress: Address;
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

function parseBridgeSymbol(applyMessage: string): string {
	// "StablecoinBridgeEURT" -> "EURT"
	// "EURC Bridge" -> "EURC"
	// "EURC Bridge Jan 2026" -> "EURC"
	// "EURe Bridge" -> "EURe"
	const prefixed = applyMessage.match(/^StablecoinBridge(\w+)$/);
	if (prefixed) return prefixed[1];

	const suffixed = applyMessage.match(/^(\w+)\s+Bridge/);
	if (suffixed) return suffixed[1];

	return applyMessage;
}

export const useBridgeStats = (): BridgeStatsResult => {
	const chainId = WAGMI_CHAIN.id as number;
	const minters = useSelector((state: RootState) => state.ecosystem.stablecoinMinters);

	const bridgeMinters = useMemo(() => {
		if (!minters?.list) return [];
		return minters.list
			.filter((m) => /bridge/i.test(m.applyMessage))
			.map((m) => ({
				address: m.minter as Address,
				symbol: parseBridgeSymbol(m.applyMessage),
			}));
	}, [minters]);

	const contracts = useMemo(
		() =>
			bridgeMinters.flatMap((b) => [
				{ chainId, address: b.address, abi: StablecoinBridgeABI, functionName: "minted" as const },
				{ chainId, address: b.address, abi: StablecoinBridgeABI, functionName: "limit" as const },
				{ chainId, address: b.address, abi: StablecoinBridgeABI, functionName: "horizon" as const },
			]),
		[bridgeMinters, chainId]
	);

	const { data, isLoading } = useReadContracts({ contracts });

	const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));

	const bridges: BridgeStat[] = bridgeMinters.map((b, i) => {
		const base = i * 3;
		const minted = data ? decodeBigIntCall(data[base] ?? 0) : 0n;
		const limit = data ? decodeBigIntCall(data[base + 1] ?? 0) : 0n;
		const horizon = data ? decodeBigIntCall(data[base + 2] ?? 0) : 0n;

		return {
			symbol: b.symbol,
			bridgeAddress: b.address,
			minted,
			limit,
			remaining: limit > minted ? limit - minted : 0n,
			horizon,
			isExpired: horizon > 0n && currentTimestamp > horizon,
		};
	});

	const totalBridgeMinted = bridges.reduce((sum, b) => sum + b.minted, 0n);

	return { bridges, totalBridgeMinted, isLoading };
};
