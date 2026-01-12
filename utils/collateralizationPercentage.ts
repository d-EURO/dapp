import { PositionQuery, PriceQueryObjectArray } from "@juicedollar/api";
import { Address } from "viem";

export function calculateCollateralizationPercentage(position: PositionQuery, prices: PriceQueryObjectArray): number {
	const collBalancePosition = Number(position.collateralBalance) / 10 ** position.collateralDecimals;

	if (collBalancePosition === 0) {
		return 0;
	}

	const collTokenPriceMarket = prices?.[position.collateral.toLowerCase() as Address]?.price?.usd;

	if (!collTokenPriceMarket) {
		return 0;
	}

	const collTokenPricePosition = Number(position.virtualPrice || position.price) / 10 ** (36 - position.collateralDecimals);
	// 1 JUSD = 1 USD, so no conversion needed
	const liquidationPrice = collTokenPricePosition;

	// Prevent division by zero
	if (liquidationPrice === 0) {
		return 0;
	}

	const marketValueCollateral = collBalancePosition * collTokenPriceMarket;
	const positionValueCollateral = collBalancePosition * liquidationPrice;

	return Math.round((marketValueCollateral / positionValueCollateral) * 10000) / 100;
}
