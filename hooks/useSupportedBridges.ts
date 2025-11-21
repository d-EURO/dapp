import { ADDRESS } from "@deuro/eurocoin";
import { Address } from "viem";
import { useChainId } from "wagmi";

export enum StablecoinSymbol {
	EURC = "EURC",
	VEUR = "VEUR",
	EURS = "EURS",
	EURR = "EURR",
	EUROP = "EUROP",
	EURI = "EURI",
	EURE = "EURE",
	EURA = "EURA",
}

export interface SupportedStablecoin {
	address: Address;
	symbol: StablecoinSymbol;
	bridgeAddress: Address;
}

export const useSupportedBridges = (): SupportedStablecoin[] => {
    const chainId = useChainId();

    return  [
		{
			address: ADDRESS[chainId].eurc,
			symbol: StablecoinSymbol.EURC,
			bridgeAddress: ADDRESS[chainId].bridgeEURC,
		},
		{
			address: ADDRESS[chainId].veur,
			symbol: StablecoinSymbol.VEUR,
			bridgeAddress: ADDRESS[chainId].bridgeVEUR,
		},
		{
			address: ADDRESS[chainId].eurs,
			symbol: StablecoinSymbol.EURS,
			bridgeAddress: ADDRESS[chainId].bridgeEURS,
		},
		{
            address: ADDRESS[chainId].eurr,
			symbol: StablecoinSymbol.EURR,
			bridgeAddress: ADDRESS[chainId].bridgeEURR,
		},
		{
            address: ADDRESS[chainId].europ,
			symbol: StablecoinSymbol.EUROP,
			bridgeAddress: ADDRESS[chainId].bridgeEUROP,
		},
		{
            address: ADDRESS[chainId].euri,
			symbol: StablecoinSymbol.EURI,
			bridgeAddress: ADDRESS[chainId].bridgeEURI,
		},
		{
            address: ADDRESS[chainId].eure,
			symbol: StablecoinSymbol.EURE,
			bridgeAddress: ADDRESS[chainId].bridgeEURE,
		},
        {
            address: ADDRESS[chainId].eura,
            symbol: StablecoinSymbol.EURA,
            bridgeAddress: ADDRESS[chainId].bridgeEURA,
        },
	];
};