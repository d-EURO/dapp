import { Address } from "viem";

export type BurnBridgeCandidate = {
	address: Address;
	balance: bigint;
};

// Highest Stablecoin balance wins; ties keep list order (first candidate).
export const selectBurnBridge = (candidates: BurnBridgeCandidate[]): BurnBridgeCandidate => {
	return candidates.reduce((best, current) => (current.balance > best.balance ? current : best));
};
