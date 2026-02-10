"use client";

import { useChainId } from "wagmi";
import { testnet } from "@config";

export function TestnetTopBar() {
	const chainId = useChainId();
	if (chainId !== testnet.id) return null;

	return (
		<div
			className="fixed top-0 left-0 right-0 z-30 h-7 flex items-center justify-center bg-red-500/80 text-white/95 text-xs font-medium"
			role="status"
			aria-label="Testnet environment"
		>
			You are on testnet
		</div>
	);
}
