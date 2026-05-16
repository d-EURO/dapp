import { PositionQuery } from "@deuro/api";
import { toDate } from "./format";

export type LoanDetails = {
	loanAmount: bigint;
	apr: number;
	interestUntilExpiration: bigint;
	borrowersReserveContribution: bigint;
	amountToSendToWallet: bigint;
	requiredCollateral: bigint;
	originalPosition: `0x${string}`;
	effectiveInterest: number;
	liquidationPrice: bigint;
	startingLiquidationPrice: bigint;
};

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

const getLoanDuration = (position: PositionQuery, customExpirationDate?: Date) => {
	const expirationDate = customExpirationDate || toDate(position.expiration);
	return Math.max(60 * 60 * 24 * 30, Math.floor((expirationDate.getTime() - Date.now()) / 1000));
};

const getMiscelaneousLoanDetails = (position: PositionQuery, loanAmount: bigint, collateralAmount: bigint, customExpirationDate?: Date) => {
	const { fixedAnnualRatePPM, annualInterestPPM, collateralDecimals, reserveContribution } = position;

	const apr = Number((BigInt(fixedAnnualRatePPM) * 100n) / 1_000_000n);
	const effectiveInterest = (fixedAnnualRatePPM / 10 ** 6 / (1 - reserveContribution / 10 ** 6)) * 100;
	const selectedPeriod = getLoanDuration(position, customExpirationDate);
	const interestUntilExpiration =
		(BigInt(selectedPeriod) * BigInt(annualInterestPPM) * BigInt(loanAmount)) / BigInt(ONE_YEAR_IN_SECONDS * 1_000_000);
	const liquidationPriceAtEnd =
		collateralAmount === 0n
			? BigInt(0)
			: ((loanAmount + interestUntilExpiration) * BigInt(10) ** BigInt(collateralDecimals)) / collateralAmount;

	return {
		effectiveInterest,
		apr,
		interestUntilExpiration,
		liquidationPriceAtEnd,
	};
};

export const getLoanDetailsByCollateralAndLiqPrice = (
	position: PositionQuery,
	collateralAmount: bigint,
	liquidationPriceAtEndOfPeriod: bigint,
	customExpirationDate?: Date
): LoanDetails => {
	const { reserveContribution, collateralDecimals, original, annualInterestPPM } = position;

	const requiredCollateral = collateralAmount;
	const decimalsAdjustment = collateralDecimals === 0 ? BigInt(1e36) : BigInt(1e18);
	const loanAmountEndOfPeriod = (BigInt(collateralAmount) * BigInt(liquidationPriceAtEndOfPeriod)) / decimalsAdjustment;

	const selectedPeriod = getLoanDuration(position, customExpirationDate);
	const loanAmountAtStartOfPeriod =
		(loanAmountEndOfPeriod * BigInt(ONE_YEAR_IN_SECONDS * 1_000_000)) /
		(BigInt(ONE_YEAR_IN_SECONDS * 1_000_000) + BigInt(selectedPeriod) * BigInt(annualInterestPPM));
	const interestUntilExpiration = loanAmountEndOfPeriod - loanAmountAtStartOfPeriod;

	const borrowersReserveContribution = (BigInt(reserveContribution) * loanAmountAtStartOfPeriod) / 1_000_000n;
	const amountToSendToWallet = loanAmountAtStartOfPeriod - borrowersReserveContribution;

	const { effectiveInterest, apr } = getMiscelaneousLoanDetails(position, loanAmountEndOfPeriod, collateralAmount, customExpirationDate);

	const startingLiquidationPrice =
		collateralAmount === 0n ? BigInt(0) : (loanAmountAtStartOfPeriod * decimalsAdjustment) / collateralAmount;

	return {
		loanAmount: loanAmountAtStartOfPeriod,
		apr,
		interestUntilExpiration,
		borrowersReserveContribution,
		requiredCollateral,
		amountToSendToWallet: amountToSendToWallet < 0n ? 0n : amountToSendToWallet,
		originalPosition: original,
		effectiveInterest,
		liquidationPrice: liquidationPriceAtEndOfPeriod,
		startingLiquidationPrice,
	};
};

export const getLoanDetailsByCollateralAndStartingLiqPrice = (
	position: PositionQuery,
	collateralAmount: bigint,
	startingLiquidationPrice: bigint,
	customExpirationDate?: Date
): LoanDetails => {
	const { reserveContribution, collateralDecimals, original, annualInterestPPM } = position;

	const requiredCollateral = collateralAmount;
	const decimalsAdjustment = collateralDecimals === 0 ? BigInt(1e36) : BigInt(1e18);
	const loanAmountStartOfPeriod = (collateralAmount * startingLiquidationPrice) / decimalsAdjustment;

	const borrowersReserveContribution = (BigInt(reserveContribution) * loanAmountStartOfPeriod) / 1_000_000n;
	const amountToSendToWallet = loanAmountStartOfPeriod - borrowersReserveContribution;

	const { effectiveInterest, apr, interestUntilExpiration } = getMiscelaneousLoanDetails(
		position,
		loanAmountStartOfPeriod,
		collateralAmount,
		customExpirationDate
	);

	const liquidationPriceAtEndOfPeriod =
		collateralAmount === 0n
			? BigInt(0)
			: ((loanAmountStartOfPeriod + interestUntilExpiration) * BigInt(10) ** BigInt(collateralDecimals)) / collateralAmount;

	return {
		loanAmount: loanAmountStartOfPeriod,
		apr,
		borrowersReserveContribution,
		interestUntilExpiration,
		requiredCollateral,
		amountToSendToWallet: amountToSendToWallet < 0n ? 0n : amountToSendToWallet,
		originalPosition: original,
		effectiveInterest,
		liquidationPrice: liquidationPriceAtEndOfPeriod,
		startingLiquidationPrice: startingLiquidationPrice / BigInt(10) ** BigInt(collateralDecimals),
	};
};

export const getLoanDetailsByCollateralAndYouGetAmount = (
	position: PositionQuery,
	collateralAmount: bigint,
	youGet: bigint,
	customExpirationDate?: Date
): LoanDetails => {
	const { reserveContribution, collateralDecimals, original, annualInterestPPM } = position;

	const requiredCollateral = collateralAmount;
	const amountToSendToWallet = youGet;
	const decimalsAdjustment = collateralDecimals === 0 ? BigInt(1e36) : BigInt(1e18);
	const loanAmountStartOfPeriod = (amountToSendToWallet * 1_000_000n) / (1_000_000n - BigInt(reserveContribution));
	const startingLiquidationPrice =
		collateralAmount === 0n ? BigInt(0) : (loanAmountStartOfPeriod * decimalsAdjustment) / collateralAmount;
	const borrowersReserveContribution = (BigInt(reserveContribution) * loanAmountStartOfPeriod) / 1_000_000n;

	const { effectiveInterest, apr, interestUntilExpiration, liquidationPriceAtEnd } = getMiscelaneousLoanDetails(
		position,
		loanAmountStartOfPeriod,
		collateralAmount,
		customExpirationDate
	);

	return {
		loanAmount: loanAmountStartOfPeriod,
		apr,
		interestUntilExpiration,
		borrowersReserveContribution,
		requiredCollateral,
		amountToSendToWallet: amountToSendToWallet < 0n ? 0n : amountToSendToWallet,
		originalPosition: original,
		effectiveInterest,
		liquidationPrice: liquidationPriceAtEnd,
		startingLiquidationPrice,
	};
};

/**
 * Maximum additional net dEURO payout a borrower can mint on an existing position
 * before tripping Position._checkCollateral on-chain (MintingHubV3/Position.sol).
 *
 * Mirrors:
 *   _getCollateralRequirement = principal + ceilDivPPM(_calculateInterest(), reserveContribution)
 *   _checkCollateral:  collateral × price ≥ collateralRequirement × 1e18
 *
 * Result is the *net* amount that lands in the wallet, i.e. after the reserve cut.
 */
export const calculateNetBorrowHeadroom = (params: {
	collateralBalance: bigint;
	price: bigint;
	principal: bigint;
	interest: bigint;
	reserveContribution: bigint;
	availableForMinting: bigint;
	collateralDecimals: number;
}): bigint => {
	const { collateralBalance, price, principal, interest, reserveContribution, availableForMinting, collateralDecimals } = params;
	const decimalsAdjustment = collateralDecimals === 0 ? BigInt(1e36) : BigInt(1e18);
	const collateralValue = (collateralBalance * price) / decimalsAdjustment;
	const usablePPM = 1_000_000n - reserveContribution;
	if (usablePPM <= 0n) return 0n;
	const interestOverhead = (interest * 1_000_000n + usablePPM - 1n) / usablePPM;
	const collateralRequirement = principal + interestOverhead;
	const grossHeadroomByCollateral = collateralValue > collateralRequirement ? collateralValue - collateralRequirement : 0n;
	const grossHeadroom = grossHeadroomByCollateral < availableForMinting ? grossHeadroomByCollateral : availableForMinting;
	return (grossHeadroom * usablePPM) / 1_000_000n;
};
