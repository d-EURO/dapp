import { useWeb3ModalState } from "@web3modal/wagmi/react";
import { useAccount, useChainId } from "wagmi";
import { mainnet } from "@config";

export const useIsConnectedToCorrectChain = (): boolean => {
	const { address, chain, isConnected } = useAccount();
	const { selectedNetworkId } = useWeb3ModalState();

	if (!isConnected || !chain || !address) return false;
	return selectedNetworkId ? parseInt(selectedNetworkId) === chain.id : false;
};

export const useIsMainnet = (): boolean => {
	return useChainId() === mainnet.id;
};
