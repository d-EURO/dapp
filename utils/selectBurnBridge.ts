import { Address } from "viem";

export type BurnBridgeCandidate = {
	address: Address;
	balance: bigint;
	minted: bigint;
	decimals: bigint;
};

export type SelectedBurnBridge = {
	address: Address;
	capacity: bigint;
};

// minted is 18-dec dEURO; balance is stablecoin units. Floor-divide like StablecoinBridge._convertAmount.
export const burnBridgeCapacity = (balance: bigint, minted: bigint, stablecoinDecimals: bigint): bigint => {
	const mintedInSourceUnits = minted / 10n ** (18n - stablecoinDecimals);
	return balance < mintedInSourceUnits ? balance : mintedInSourceUnits;
};

// Highest burn capacity wins; ties keep list order (first candidate).
export const selectBurnBridge = (candidates: BurnBridgeCandidate[]): SelectedBurnBridge => {
	const ranked = candidates.map((candidate) => ({
		address: candidate.address,
		capacity: burnBridgeCapacity(candidate.balance, candidate.minted, candidate.decimals),
	}));
	return ranked.reduce((best, current) => (current.capacity > best.capacity ? current : best));
};
