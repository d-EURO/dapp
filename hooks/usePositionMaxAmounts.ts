import { useMemo } from "react";
import { useWalletERC20Balances } from "./useWalletBalances";
import { Address } from "viem";
import { NATIVE_WRAPPED_SYMBOLS } from "@utils";
import { useNativeBalance } from "./useNativeBalance";

export const usePositionMaxAmounts = (position: any) => {
	// Fetch wallet balances
	const { balancesByAddress, refetchBalances } = useWalletERC20Balances(
		position
			? [
					{
						symbol: position.collateralSymbol,
						name: position.collateralSymbol,
						address: position.collateral as Address,
						allowance: [position.position as Address],
					},
			  ]
			: []
	);

	// Get native balance for wrapped native tokens (cBTC)
	const isNativeWrapped = position && NATIVE_WRAPPED_SYMBOLS.includes(position.collateralSymbol.toLowerCase());
	const nativeBalance = useNativeBalance();

	// Determine wallet balance (native or ERC20)
	const walletBalance = useMemo(() => {
		if (!position) return 0n;
		return isNativeWrapped ? nativeBalance.balance : balancesByAddress[position.collateral as Address]?.balanceOf || 0n;
	}, [position, isNativeWrapped, nativeBalance.balance, balancesByAddress]);

	return {
		walletBalance,
		balancesByAddress,
		refetchBalances,
	};
};
