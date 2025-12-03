import { useAccount, useBalance } from "wagmi";

export const useNativeBalance = () => {
	const { address } = useAccount();
	const { data, isError, isLoading, refetch } = useBalance({
		address,
	});

	return {
		balance: data?.value ?? 0n,
		formatted: data?.formatted ?? "0",
		symbol: data?.symbol ?? "ETH",
		decimals: data?.decimals ?? 18,
		isError,
		isLoading,
		refetch,
	};
};
