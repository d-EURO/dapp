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
	const downscale = 18n - stablecoinDecimals;
	const mintedInSourceUnits = minted / (downscale > 0n ? 10n ** downscale : 1n);
	return balance < mintedInSourceUnits ? balance : mintedInSourceUnits;
};

// Preferred address wins when it is one of the candidates, even at capacity 0.
// Otherwise the highest burn capacity wins; ties keep list order (strictly greater).
export const selectBurnBridge = (candidates: BurnBridgeCandidate[], preferredAddress?: Address): SelectedBurnBridge => {
	const ranked = candidates.map((candidate) => ({
		address: candidate.address,
		capacity: burnBridgeCapacity(candidate.balance, candidate.minted, candidate.decimals),
	}));
	if (preferredAddress !== undefined) {
		const preferred = ranked.find((candidate) => candidate.address.toLowerCase() === preferredAddress.toLowerCase());
		if (preferred !== undefined) return preferred;
	}
	return ranked.reduce((best, current) => (current.capacity > best.capacity ? current : best));
};
