import { ADDRESS as LEGACY_ADDRESS } from "@deuro/eurocoin";
import { Address, zeroAddress } from "viem";
import { ADDRESS as LOCAL_ADDRESS, type ChainAddress as LocalChainAddress } from "../../smartContracts/exports/address.config";
import { MintingHubV3ABI } from "../../smartContracts/exports/abis/v3/MintingHub";
import { SavingsV3ABI } from "../../smartContracts/exports/abis/v3/Savings";
import { SavingsVaultDEUROABI } from "../../smartContracts/exports/abis/v3/SavingsVaultDEURO";
import { MintingHubGatewayV2ABI } from "../../smartContracts/exports/abis/v2/MintingHubGateway";
import { SavingsGatewayV2ABI } from "../../smartContracts/exports/abis/v2/SavingsGateway";

type LegacyChainAddress = (typeof LEGACY_ADDRESS)[number];

export type AppChainAddress = LegacyChainAddress &
	Partial<Omit<LocalChainAddress, "savings" | "mintingHub" | "savingsVaultV2" | "savingsVaultV3">> & {
		savings: Address;
		mintingHub: Address;
		savingsVaultV2: Address;
		savingsVaultV3: Address;
	};

export const getAppAddresses = (chainId: number): AppChainAddress => {
	const legacy = LEGACY_ADDRESS[chainId] ?? LEGACY_ADDRESS[1];
	const local = LOCAL_ADDRESS[chainId] ?? {};
	return {
		...legacy,
		...local,
		savings: local.savings ?? zeroAddress,
		mintingHub: local.mintingHub ?? zeroAddress,
		savingsVaultV2: local.savingsVaultV2 ?? zeroAddress,
		savingsVaultV3: local.savingsVaultV3 ?? zeroAddress,
	};
};

export const isDeployed = (address?: string): address is Address => !!address && address !== zeroAddress;

export const isV3Position = (mintingHubAddress?: string, chainId?: number): boolean => {
	if (!mintingHubAddress || chainId == null) return false;
	const addresses = getAppAddresses(chainId);
	return isDeployed(addresses.mintingHub) && mintingHubAddress.toLowerCase() === addresses.mintingHub.toLowerCase();
};

export {
	MintingHubGatewayV2ABI,
	MintingHubV3ABI,
	SavingsGatewayV2ABI,
	SavingsV3ABI,
	SavingsVaultDEUROABI,
};
