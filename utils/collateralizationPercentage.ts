import { PositionQuery, PriceQueryObjectArray } from "@juicedollar/api";
import { Address } from "viem";

export function calculateCollateralizationPercentage(position: PositionQuery, prices: PriceQueryObjectArray): number {
	const collBalancePosition = Number(position.collateralBalance) / 10 ** position.collateralDecimals;

	if (collBalancePosition === 0) {
		return 0;
	}

	const collTokenPriceMarket = prices?.[position.collateral.toLowerCase() as Address]?.price?.eur;

	if (!collTokenPriceMarket) {
		return 0;
	}

	const collTokenPricePosition = Number(position.virtualPrice || position.price) / 10 ** (36 - position.collateralDecimals);
	const jusdPriceEur = prices?.[position.stablecoinAddress.toLowerCase() as Address]?.price?.eur || 1;
	const liquidationPriceEur = collTokenPricePosition / jusdPriceEur;

	const marketValueCollateral = collBalancePosition * collTokenPriceMarket;
	const positionValueCollateral = collBalancePosition * liquidationPriceEur;

	return Math.round((marketValueCollateral / positionValueCollateral) * 10000) / 100;
}
