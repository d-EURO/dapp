import { ADDRESS, type ChainAddress } from "@deuro/eurocoin";
import { Address, zeroAddress } from "viem";

export type AppChainAddress = ChainAddress;

export const getAppAddresses = (chainId: number): AppChainAddress => ADDRESS[chainId] ?? ADDRESS[1];

export const isDeployed = (address?: string): address is Address => !!address && address !== zeroAddress;

export {
	MintingHubGatewayV2ABI,
	MintingHubV3ABI,
	SavingsGatewayV2ABI,
	SavingsV3ABI,
	SavingsVaultDEUROABI,
} from "@deuro/eurocoin";
