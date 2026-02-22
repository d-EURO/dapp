import { useMemo } from "react";
import { useSelector } from "react-redux";
import { useReadContracts } from "wagmi";
import { decodeBigIntCall } from "@utils";
import { StablecoinBridgeABI } from "@deuro/eurocoin";
import { Address } from "viem";
import { RootState } from "../redux/redux.store";
import { WAGMI_CHAIN } from "../app.config";

export interface SupportedStablecoin {
	address: Address;
	symbol: string;
	key: string;
	bridgeAddress: Address;
}

function parseBridgeSymbol(applyMessage: string): string {
	const prefixed = applyMessage.match(/^StablecoinBridge(\w+)$/);
	if (prefixed) return prefixed[1];

	const suffixed = applyMessage.match(/^(\w+)\s+Bridge/);
	if (suffixed) return suffixed[1];

	return applyMessage;
}

export const useSupportedBridges = (): SupportedStablecoin[] => {
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
				{ chainId, address: b.address, abi: StablecoinBridgeABI, functionName: "eur" as const },
				{ chainId, address: b.address, abi: StablecoinBridgeABI, functionName: "minted" as const },
				{ chainId, address: b.address, abi: StablecoinBridgeABI, functionName: "limit" as const },
				{ chainId, address: b.address, abi: StablecoinBridgeABI, functionName: "horizon" as const },
			]),
		[bridgeMinters, chainId]
	);

	const { data } = useReadContracts({ contracts });

	return useMemo(() => {
		if (!data || bridgeMinters.length === 0) return [];

		const all = bridgeMinters.map((b, i) => {
			const base = i * 4;
			const tokenAddress = (data[base]?.result as Address) ?? ("0x0" as Address);
			const minted = decodeBigIntCall(data[base + 1] ?? 0);
			const limit = decodeBigIntCall(data[base + 2] ?? 0);
			const remaining = limit > minted ? limit - minted : 0n;

			return {
				tokenAddress,
				symbol: b.symbol,
				bridgeAddress: b.address,
				minted,
				remaining,
			};
		});

		// Filter out bridges with no activity and no remaining capacity
		const active = all.filter((c) => {
			const mintedInUnits = Number(c.minted) / 1e18;
			return mintedInUnits >= 1 || c.remaining > 0n;
		});

		// Count symbols to detect duplicates
		const symbolCount = new Map<string, number>();
		for (const c of active) {
			symbolCount.set(c.symbol, (symbolCount.get(c.symbol) ?? 0) + 1);
		}

		// Assign unique keys: symbol if unique, otherwise symbol + short bridge address
		const symbolIndex = new Map<string, number>();
		return active.map((c) => {
			let key: string;
			if ((symbolCount.get(c.symbol) ?? 0) > 1) {
				const idx = (symbolIndex.get(c.symbol) ?? 0) + 1;
				symbolIndex.set(c.symbol, idx);
				key = `${c.symbol} (${c.bridgeAddress.slice(2, 8)})`;
			} else {
				key = c.symbol;
			}

			return {
				address: c.tokenAddress,
				symbol: c.symbol,
				key,
				bridgeAddress: c.bridgeAddress,
			};
		});
	}, [data, bridgeMinters]);
};
