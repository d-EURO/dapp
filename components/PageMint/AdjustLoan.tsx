import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "next-i18next";
import { Address, formatUnits } from "viem";
import { formatCurrency, normalizeTokenSymbol, NATIVE_WRAPPED_SYMBOLS } from "@utils";
import { solveManage, SolverPosition, SolverOutcome, Strategy, TxAction } from "../../utils/positionSolver";
import { Target } from "./AdjustPosition";
import { NormalInputOutlined } from "@components/Input/NormalInputOutlined";
import { AddCircleOutlineIcon } from "@components/SvgComponents/add_circle_outline";
import { RemoveCircleOutlineIcon } from "@components/SvgComponents/remove_circle_outline";
import { SvgIconButton } from "./PlusMinusButtons";
import { MaxButton } from "@components/Input/MaxButton";
import { ErrorDisplay } from "@components/ErrorDisplay";
import Button from "@components/Button";
import { Tooltip } from "flowbite-react";
import { PositionQuery } from "@juicedollar/api";
import { useChainId, useAccount } from "wagmi";
import { ADDRESS } from "@juicedollar/jusd";
import { approveToken } from "../../hooks/useApproveToken";
import { handleLoanExecute } from "../../hooks/useExecuteLoanAdjust";
import { getAmountLended, getRetainedReserve } from "../../utils/loanCalculations";

enum StrategyKey {
	ADD_COLLATERAL = "addCollateral",
	HIGHER_PRICE = "higherPrice",
}

type Strategies = Record<StrategyKey, boolean>;

interface AdjustLoanProps {
	position: PositionQuery;
	collateralBalance: bigint;
	currentDebt: bigint;
	liqPrice: bigint;
	principal: bigint;
	currentPosition: SolverPosition;
	walletBalance: bigint;
	jusdAllowance: bigint;
	refetchAllowance: () => void;
	onSuccess: () => void;
	onFullRepaySuccess: () => void;
	isInCooldown: boolean;
	cooldownRemainingFormatted: string | null;
	cooldownEndsAt?: Date;
}

export const AdjustLoan = ({
	position,
	collateralBalance,
	currentDebt,
	liqPrice,
	principal,
	currentPosition,
	walletBalance,
	jusdAllowance,
	refetchAllowance,
	onSuccess,
	onFullRepaySuccess,
	isInCooldown,
	cooldownRemainingFormatted,
	cooldownEndsAt,
}: AdjustLoanProps) => {
	const { t } = useTranslation();
	const chainId = useChainId();
	const { address: userAddress } = useAccount();
	const isNativeWrappedPosition = NATIVE_WRAPPED_SYMBOLS.includes(position.collateralSymbol?.toLowerCase() || "");
	const [isTxOnGoing, setIsTxOnGoing] = useState(false);
	const [deltaAmount, setDeltaAmount] = useState<string>("");
	const [isIncrease, setIsIncrease] = useState(true);
	const [strategies, setStrategies] = useState<Strategies>({
		[StrategyKey.ADD_COLLATERAL]: false,
		[StrategyKey.HIGHER_PRICE]: false,
	});
	const [outcome, setOutcome] = useState<SolverOutcome | null>(null);
	const [deltaAmountError, setDeltaAmountError] = useState<string | null>(null);
	const priceDecimals = 36 - (position.collateralDecimals || 18);
	const collateralDecimals = position.collateralDecimals || 18;
	const collateralSymbol = normalizeTokenSymbol(position.collateralSymbol || "");
	const cooldownDays = Math.ceil(position.challengePeriod / 60 / 60 / 24);
	const amountLended = getAmountLended(principal, position.reserveContribution);
	const retainedReserve = getRetainedReserve(principal, position.reserveContribution);

	useEffect(() => {
		setDeltaAmount("");
		setStrategies({ [StrategyKey.ADD_COLLATERAL]: false, [StrategyKey.HIGHER_PRICE]: false });
		setOutcome(null);
		setDeltaAmountError(null);
	}, [isIncrease]);

	const hasAnyStrategy = strategies[StrategyKey.ADD_COLLATERAL] || strategies[StrategyKey.HIGHER_PRICE];

	const rawMaxDebt = (BigInt(position.price) * collateralBalance) / BigInt(1e18);
	const maxDebtAtCurrentParams = rawMaxDebt - rawMaxDebt / 10000n; // 0.01% buffer for precision
	const availableWithoutAdjustment = maxDebtAtCurrentParams > currentDebt ? maxDebtAtCurrentParams - currentDebt : 0n;

	const maxDelta = useMemo(() => {
		if (!isIncrease) return currentDebt;
		if (!hasAnyStrategy) return availableWithoutAdjustment;
		if (strategies[StrategyKey.HIGHER_PRICE] && !strategies[StrategyKey.ADD_COLLATERAL]) {
			return availableWithoutAdjustment;
		}
		const maxCollateral = strategies[StrategyKey.ADD_COLLATERAL] ? collateralBalance + walletBalance : collateralBalance;
		const maxPrice = strategies[StrategyKey.HIGHER_PRICE] ? BigInt(position.price) : liqPrice;
		const rawMaxDebtStrategy = (maxPrice * maxCollateral) / BigInt(1e18);
		const maxDebt = rawMaxDebtStrategy - rawMaxDebtStrategy / 10000n;
		const deltaFromStrategies = maxDebt > currentDebt ? maxDebt - currentDebt : 0n;
		return deltaFromStrategies > availableWithoutAdjustment ? deltaFromStrategies : availableWithoutAdjustment;
	}, [
		isIncrease,
		hasAnyStrategy,
		strategies,
		liqPrice,
		collateralBalance,
		currentDebt,
		walletBalance,
		position.price,
		availableWithoutAdjustment,
	]);

	const delta = BigInt(deltaAmount || 0);
	const showStrategyOptions = isIncrease && delta > availableWithoutAdjustment;
	const FULL_REPAY_THRESHOLD = currentDebt / 1000n;
	const isFullRepay = !isIncrease && delta > 0n && (delta >= currentDebt || currentDebt - delta <= FULL_REPAY_THRESHOLD);

	useEffect(() => {
		if (!deltaAmount) return setOutcome(null);
		try {
			const delta = BigInt(deltaAmount);
			if (delta === 0n) return setOutcome(null);
			if (!isIncrease) {
				const isFullRepayNow = delta >= currentDebt || currentDebt - delta <= currentDebt / 1000n;
				if (isFullRepayNow) {
					return setOutcome({
						next: {
							collateral: 0n,
							debt: 0n,
							liqPrice,
							expiration: currentPosition.expiration,
						},
						deltaCollateral: -collateralBalance,
						deltaDebt: -currentDebt,
						deltaLiqPrice: 0n,
						txPlan: [TxAction.REPAY, TxAction.WITHDRAW],
						isValid: true,
					});
				}
				return setOutcome(solveManage(currentPosition, Target.LOAN, Strategy.KEEP_COLLATERAL, currentDebt - delta));
			}
			const newDebt = currentDebt + delta;
			const maxDebtNoAdjust = (BigInt(position.price) * collateralBalance) / BigInt(1e18);
			const canBorrowWithoutAdjustment = newDebt <= maxDebtNoAdjust;
			if (!strategies[StrategyKey.ADD_COLLATERAL] && !strategies[StrategyKey.HIGHER_PRICE] && !canBorrowWithoutAdjustment)
				return setOutcome(null);
			if (canBorrowWithoutAdjustment) {
				return setOutcome({
					next: {
						collateral: collateralBalance,
						debt: newDebt,
						liqPrice: BigInt(position.price),
						expiration: currentPosition.expiration,
					},
					deltaCollateral: 0n,
					deltaDebt: delta,
					deltaLiqPrice: 0n,
					txPlan: [TxAction.BORROW],
					isValid: true,
				});
			}
			if (strategies[StrategyKey.ADD_COLLATERAL] && strategies[StrategyKey.HIGHER_PRICE]) {
				const [collatOutcome, priceOutcome] = [
					solveManage(currentPosition, Target.LOAN, Strategy.KEEP_LIQ_PRICE, newDebt),
					solveManage(currentPosition, Target.LOAN, Strategy.KEEP_COLLATERAL, newDebt),
				];
				if (collatOutcome && priceOutcome) {
					return setOutcome({
						...collatOutcome,
						deltaLiqPrice: priceOutcome.deltaLiqPrice,
						next: { ...collatOutcome.next, liqPrice: priceOutcome.next.liqPrice },
					});
				}
			}
			const strategy = strategies[StrategyKey.ADD_COLLATERAL] ? Strategy.KEEP_LIQ_PRICE : Strategy.KEEP_COLLATERAL;
			setOutcome(solveManage(currentPosition, Target.LOAN, strategy, newDebt));
		} catch {
			setOutcome(null);
		}
	}, [currentPosition, deltaAmount, isIncrease, strategies, currentDebt, collateralBalance, liqPrice]);

	useEffect(() => {
		if (!deltaAmount || isIncrease) return setDeltaAmountError(null);
		const delta = BigInt(deltaAmount || 0);
		const exceedsMax = delta > maxDelta && maxDelta > 0n;
		setDeltaAmountError(exceedsMax ? t("mint.error.amount_greater_than_max_to_remove") : null);
	}, [deltaAmount, isIncrease, maxDelta, t]);

	const repayAmount = useMemo(() => (!outcome || outcome.deltaDebt >= 0n ? 0n : -outcome.deltaDebt), [outcome]);
	const needsApproval = repayAmount > 0n && jusdAllowance < repayAmount;
	const handleMaxClick = () => setDeltaAmount(maxDelta.toString());

	const handleApprove = async () => {
		if (repayAmount <= 0n) return;
		setIsTxOnGoing(true);
		await approveToken({
			tokenAddress: ADDRESS[chainId]?.juiceDollar as Address,
			spender: position.position as Address,
			amount: repayAmount * 2n,
			t,
			onSuccess: refetchAllowance,
		});
		setIsTxOnGoing(false);
	};

	const handleExecute = () => {
		if (!outcome || !outcome.isValid || !position || !userAddress) return;
		handleLoanExecute({
			outcome,
			position,
			userAddress: userAddress as Address,
			principal,
			collateralBalance,
			isNativeWrappedPosition,
			t,
			onSuccess: isFullRepay
				? onFullRepaySuccess
				: () => {
						setDeltaAmount("");
						setStrategies({ [StrategyKey.ADD_COLLATERAL]: false, [StrategyKey.HIGHER_PRICE]: false });
						onSuccess();
				  },
			setIsTxOnGoing,
		});
	};

	const toggleStrategy = (strategy: StrategyKey) => setStrategies((prev) => ({ ...prev, [strategy]: !prev[strategy] }));

	const DefaultSummaryTable = () => (
		<div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
			<div className="flex justify-between text-sm">
				<span className="text-text-muted2">{t("mint.amount_lended")}</span>
				<span className="font-medium text-text-title">{formatCurrency(formatUnits(amountLended, 18), 0, 2)} JUSD</span>
			</div>
			<div className="flex justify-between text-sm">
				<span className="text-text-muted2">{t("mint.retained_reserve")}</span>
				<span className="font-medium text-text-title">{formatCurrency(formatUnits(retainedReserve, 18), 0, 2)} JUSD</span>
			</div>
			<div className="flex justify-between text-sm pt-2 border-t border-gray-300 dark:border-gray-600">
				<span className="text-text-muted2 font-medium">{t("mint.total")}</span>
				<span className="font-medium text-text-title">{formatCurrency(formatUnits(currentDebt, 18), 0, 2)} JUSD</span>
			</div>
		</div>
	);

	return (
		<div className="flex flex-col gap-y-4">
			<div className="flex flex-col gap-y-3">
				<div className="flex flex-row justify-between items-center">
					<div className="text-lg font-bold">{isIncrease ? t("mint.borrow_more") : t("mint.repay_loan")}</div>
					<div className="flex flex-row items-center">
						<SvgIconButton isSelected={isIncrease} onClick={() => setIsIncrease(true)} SvgComponent={AddCircleOutlineIcon}>
							{t("mint.borrow_more")}
						</SvgIconButton>
						<SvgIconButton isSelected={!isIncrease} onClick={() => setIsIncrease(false)} SvgComponent={RemoveCircleOutlineIcon}>
							{t("mint.repay_loan")}
						</SvgIconButton>
					</div>
				</div>
				<NormalInputOutlined
					value={deltaAmount}
					onChange={setDeltaAmount}
					decimals={18}
					unit={position.stablecoinSymbol}
					isError={Boolean(deltaAmountError)}
					adornamentRow={
						<div className="self-stretch justify-start items-center inline-flex">
							<div className="grow shrink basis-0 h-4 px-2 justify-start items-center gap-2 flex max-w-full overflow-hidden"></div>
							<div className="h-7 justify-end items-center gap-2.5 flex">
								<div className="text-input-label text-xs font-medium leading-none">
									{formatUnits(maxDelta, 18)} {position.stablecoinSymbol}
								</div>
								<MaxButton disabled={maxDelta === 0n} onClick={handleMaxClick} />
							</div>
						</div>
					}
				/>
				<ErrorDisplay error={deltaAmountError} />
			</div>

			{showStrategyOptions && !hasAnyStrategy && (
				<div className="space-y-1 px-4">
					<div className="text-sm font-medium text-text-title">{t("mint.position_needs_adjustments")}</div>
					{!strategies[StrategyKey.ADD_COLLATERAL] && (
						<div
							role="button"
							tabIndex={0}
							onClick={() => toggleStrategy(StrategyKey.ADD_COLLATERAL)}
							onKeyDown={(e) => e.key === "Enter" && toggleStrategy(StrategyKey.ADD_COLLATERAL)}
							className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
						>
							<div className="flex items-center gap-1">
								<span className="text-sm text-text-title">{t("mint.more_collateral")}</span>
								<Tooltip content={t("mint.tooltip_add_collateral")} arrow style="light">
									<span className="w-4 h-4 text-primary flex items-center">
										<AddCircleOutlineIcon color="currentColor" />
									</span>
								</Tooltip>
							</div>
						</div>
					)}
					{!strategies[StrategyKey.HIGHER_PRICE] && (
						<div
							role="button"
							tabIndex={0}
							onClick={() => toggleStrategy(StrategyKey.HIGHER_PRICE)}
							onKeyDown={(e) => e.key === "Enter" && toggleStrategy(StrategyKey.HIGHER_PRICE)}
							className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
						>
							<div className="flex items-center gap-1">
								<span className="text-sm text-text-title">{t("mint.higher_liq_price")}</span>
								<Tooltip content={t("mint.tooltip_add_liq_price")} arrow style="light">
									<span className="w-4 h-4 text-primary flex items-center">
										<AddCircleOutlineIcon color="currentColor" />
									</span>
								</Tooltip>
							</div>
						</div>
					)}
				</div>
			)}

			{isIncrease && (
				<div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
					{strategies[StrategyKey.ADD_COLLATERAL] && outcome && (
						<div className="flex justify-between text-sm">
							<div className="flex items-center gap-1">
								<span className="text-text-muted2">{t("mint.more_collateral")}</span>
								<Tooltip content={t("mint.tooltip_remove_collateral")} arrow style="light">
									<span
										className="w-4 h-4 text-primary cursor-pointer hover:opacity-80 flex items-center"
										onClick={() => toggleStrategy(StrategyKey.ADD_COLLATERAL)}
									>
										<RemoveCircleOutlineIcon color="currentColor" />
									</span>
								</Tooltip>
							</div>
							<span className="font-medium text-text-title">
								{formatCurrency(formatUnits(outcome.deltaCollateral, collateralDecimals), 0, 6)} {collateralSymbol}
							</span>
						</div>
					)}
					{strategies[StrategyKey.HIGHER_PRICE] && outcome && (
						<div className="flex justify-between text-sm">
							<div className="flex items-center gap-1">
								<span className="text-text-muted2">{t("mint.higher_liq_price")}</span>
								<Tooltip content={t("mint.tooltip_remove_liq_price")} arrow style="light">
									<span
										className="w-4 h-4 text-primary cursor-pointer hover:opacity-80 flex items-center"
										onClick={() => toggleStrategy(StrategyKey.HIGHER_PRICE)}
									>
										<RemoveCircleOutlineIcon color="currentColor" />
									</span>
								</Tooltip>
							</div>
							<span className="font-medium text-text-title">
								{formatCurrency(formatUnits(outcome.next.liqPrice, priceDecimals), 0, 0)} JUSD
							</span>
						</div>
					)}
					<div className="flex justify-between text-sm">
						<span className="text-text-muted2">{t("mint.amount_lended")}</span>
						<span className="font-medium text-text-title">
							{formatCurrency(formatUnits(getAmountLended(principal + delta, position.reserveContribution), 18), 0, 2)} JUSD
						</span>
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-text-muted2">{t("mint.retained_reserve")}</span>
						<span className="font-medium text-text-title">
							{formatCurrency(formatUnits(getRetainedReserve(principal + delta, position.reserveContribution), 18), 0, 2)}{" "}
							JUSD
						</span>
					</div>
					<div className="flex justify-between text-sm pt-2 border-t border-gray-300 dark:border-gray-600">
						<span className="text-text-muted2 font-medium">{t("mint.total")}</span>
						<span className="font-medium text-text-title">
							{formatCurrency(formatUnits(currentDebt + delta, 18), 0, 2)} JUSD
						</span>
					</div>
				</div>
			)}

			{strategies[StrategyKey.HIGHER_PRICE] && outcome && outcome.next.liqPrice > liqPrice && (
				<div className="text-xs text-text-muted2 px-4">
					{t("mint.cooldown_warning", { days: cooldownDays, dayLabel: cooldownDays === 1 ? t("common.day") : t("common.days") })}
				</div>
			)}

			{!isIncrease && (
				<>
					<div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
						{isFullRepay && (
							<div className="flex justify-between text-sm">
								<span className="text-text-muted2">{t("mint.collateral_returned")}</span>
								<span className="font-medium text-green-600 dark:text-green-400">
									+{formatCurrency(formatUnits(collateralBalance, collateralDecimals), 0, 6)} {collateralSymbol}
								</span>
							</div>
						)}
						<div className="flex justify-between text-sm">
							<span className="text-text-muted2">{t("mint.amount_lended")}</span>
							<span className="font-medium text-text-title">
								{formatCurrency(
									formatUnits(
										delta >= principal ? 0n : getAmountLended(principal - delta, position.reserveContribution),
										18
									),
									0,
									2
								)}{" "}
								JUSD
							</span>
						</div>
						<div className="flex justify-between text-sm">
							<span className="text-text-muted2">{t("mint.retained_reserve")}</span>
							<span className="font-medium text-text-title">
								{formatCurrency(
									formatUnits(
										delta >= principal ? 0n : getRetainedReserve(principal - delta, position.reserveContribution),
										18
									),
									0,
									2
								)}{" "}
								JUSD
							</span>
						</div>
						<div className="flex justify-between text-sm pt-2 border-t border-gray-300 dark:border-gray-600">
							<span className="text-text-muted2 font-medium">{t("mint.total")}</span>
							<span className="font-medium text-text-title">
								{formatCurrency(formatUnits(delta >= currentDebt ? 0n : currentDebt - delta, 18), 0, 2)} JUSD
							</span>
						</div>
					</div>
				</>
			)}

			{((isIncrease && isInCooldown) || (!isIncrease && isFullRepay && isInCooldown)) && (
				<div className="text-xs text-text-muted2 px-4">
					{t("mint.cooldown_please_wait", { remaining: cooldownRemainingFormatted })}
					<br />
					{t("mint.cooldown_ends_at", { date: cooldownEndsAt?.toLocaleString() })}
				</div>
			)}

			<Button
				className="w-full text-lg leading-snug !font-extrabold"
				onClick={needsApproval ? handleApprove : handleExecute}
				disabled={
					!outcome ||
					!outcome.isValid ||
					isTxOnGoing ||
					Boolean(deltaAmountError) ||
					(isIncrease && isInCooldown) ||
					(!isIncrease && isFullRepay && isInCooldown)
				}
				isLoading={isTxOnGoing}
			>
				{needsApproval
					? t("common.approve")
					: isFullRepay
					? t("mint.confirm_close_position")
					: strategies[StrategyKey.HIGHER_PRICE] && outcome && outcome.deltaLiqPrice > 0n && outcome.deltaDebt > 0n
					? t("mint.adjust_liq_price_btn")
					: delta === 0n
					? isIncrease
						? t("mint.lend")
						: t("mint.repay")
					: !isIncrease
					? `${t("mint.repay")} ${formatCurrency(formatUnits(delta, 18), 0, 2)} ${position.stablecoinSymbol}`
					: `${t("mint.lend")} ${formatCurrency(formatUnits(delta, 18), 0, 2)} ${position.stablecoinSymbol}`}
			</Button>
		</div>
	);
};
