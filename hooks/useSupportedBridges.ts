import { ADDRESS } from "@deuro/eurocoin";
import { Address } from "viem";
import { useChainId } from "wagmi";

export enum StablecoinSymbol {
	EURC = "EURC",
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
	burnBridgeAddresses: Address[];
}

export const useSupportedBridges = (): SupportedStablecoin[] => {
	const chainId = useChainId();

	return [
		{
			address: ADDRESS[chainId].eurc,
			symbol: StablecoinSymbol.EURC,
			// eurocoin 2.1.0 (2026-03-23) still exports the expired EURC bridge as ADDRESS.bridgeEURC.
			bridgeAddress: "0xdcc4835B34b4c05eB28B8defaC4d03d00842c2dF", // mint: 10M limit, horizon 2027-01-02 (rotation 2026-09-07)
			burnBridgeAddresses: [
				"0xdcc4835B34b4c05eB28B8defaC4d03d00842c2dF",
				"0xB4fF7412f08C22d7381885e8BdA9EE9825092fd1", // expired 2026-09-05; burn still served ~525k EURC as of 2026-09-07
			],
		},
		{
			address: ADDRESS[chainId].eurs,
			symbol: StablecoinSymbol.EURS,
			bridgeAddress: ADDRESS[chainId].bridgeEURS,
			burnBridgeAddresses: [ADDRESS[chainId].bridgeEURS],
		},
		{
			address: ADDRESS[chainId].eurr,
			symbol: StablecoinSymbol.EURR,
			bridgeAddress: ADDRESS[chainId].bridgeEURR,
			burnBridgeAddresses: [ADDRESS[chainId].bridgeEURR],
		},
		{
			address: ADDRESS[chainId].europ,
			symbol: StablecoinSymbol.EUROP,
			bridgeAddress: ADDRESS[chainId].bridgeEUROP,
			burnBridgeAddresses: [ADDRESS[chainId].bridgeEUROP],
		},
		{
			address: ADDRESS[chainId].euri,
			symbol: StablecoinSymbol.EURI,
			bridgeAddress: ADDRESS[chainId].bridgeEURI,
			burnBridgeAddresses: [ADDRESS[chainId].bridgeEURI],
		},
		{
			address: ADDRESS[chainId].eure,
			symbol: StablecoinSymbol.EURE,
			bridgeAddress: ADDRESS[chainId].bridgeEURE,
			burnBridgeAddresses: [ADDRESS[chainId].bridgeEURE],
		},
		{
			address: ADDRESS[chainId].eura,
			symbol: StablecoinSymbol.EURA,
			bridgeAddress: ADDRESS[chainId].bridgeEURA,
			burnBridgeAddresses: [ADDRESS[chainId].bridgeEURA],
		},
	];
};
