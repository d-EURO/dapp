import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "next-i18next";
import { useRouter } from "next/router";
import { Address, formatUnits } from "viem";
import { formatCurrency, normalizeTokenSymbol, getDisplayDecimals, formatPositionValue, NATIVE_WRAPPED_SYMBOLS } from "@utils";
import { NormalInputOutlined } from "@components/Input/NormalInputOutlined";
import { AddCircleOutlineIcon } from "@components/SvgComponents/add_circle_outline";
import { RemoveCircleOutlineIcon } from "@components/SvgComponents/remove_circle_outline";
import { SvgIconButton } from "./PlusMinusButtons";
import { MaxButton } from "@components/Input/MaxButton";
import Button from "@components/Button";
import { PositionQuery } from "@juicedollar/api";
import { useAccount } from "wagmi";
import { PositionV2ABI } from "@juicedollar/jusd";
import { writeContract, waitForTransactionReceipt, getPublicClient } from "wagmi/actions";
import { WAGMI_CONFIG } from "../../app.config";
import { toast } from "react-toastify";
import { TxToast, renderErrorTxToast } from "@components/TxToast";
import { store } from "../../redux/redux.store";
import { fetchPositionsList } from "../../redux/slices/positions.slice";
import { Tooltip } from "flowbite-react";
import { approveToken } from "../../hooks/useApproveToken";

enum StrategyKey {
	HIGHER_PRICE = "higherPrice",
	REPAY_LOAN = "repayLoan",
}

type Strategies = Record<StrategyKey, boolean>;

interface AdjustCollateralProps {
	position: PositionQuery;
	collateralBalance: bigint;
	currentDebt: bigint;
	positionPrice: bigint;
	principal: bigint;
	walletBalance: bigint;
	minimumCollateral: bigint;
	jusdBalance: bigint;
	jusdAllowance: bigint;
	refetchAllowance: () => void;
	isInCooldown: boolean;
	cooldownRemainingFormatted: string | null;
	cooldownEndsAt?: Date;
	onSuccess: () => void;
}

export const AdjustCollateral = ({
	position,
	collateralBalance,
	currentDebt,
	positionPrice,
	principal,
	walletBalance,
	minimumCollateral,
	jusdBalance,
	jusdAllowance,
	refetchAllowance,
	isInCooldown,
	cooldownRemainingFormatted,
	cooldownEndsAt,
	onSuccess,
}: AdjustCollateralProps) => {
	const { t } = useTranslation();
	const router = useRouter();
	const { address: userAddress } = useAccount();
	const isNativeWrappedPosition = NATIVE_WRAPPED_SYMBOLS.includes(position.collateralSymbol?.toLowerCase() || "");

	const [isTxOnGoing, setIsTxOnGoing] = useState(false);
	const [deltaAmount, setDeltaAmount] = useState<string>("");
	const [isIncrease, setIsIncrease] = useState(true);
	const [deltaAmountError, setDeltaAmountError] = useState<string | null>(null);
	const [strategies, setStrategies] = useState<Strategies>({
		[StrategyKey.HIGHER_PRICE]: false,
		[StrategyKey.REPAY_LOAN]: false,
	});

	const collateralDecimals = position.collateralDecimals || 18;
	const collateralSymbol = normalizeTokenSymbol(position.collateralSymbol || "");
	const priceDecimals = 36 - collateralDecimals;

	useEffect(() => {
		setDeltaAmount("");
		setDeltaAmountError(null);
		setStrategies({ [StrategyKey.HIGHER_PRICE]: false, [StrategyKey.REPAY_LOAN]: false });
	}, [isIncrease]);

	const minCollateralNeeded = currentDebt > 0n ? (currentDebt * BigInt(1e18)) / positionPrice : 0n;
	const minCollateralWithBuffer = (minCollateralNeeded * 101n) / 100n;
	const minimumCollateralValue = BigInt(position.minimumCollateral || 0);
	const requiredCollateral = minCollateralWithBuffer > minimumCollateralValue ? minCollateralWithBuffer : minimumCollateralValue;
	const maxRemovableWithoutAdjustment = collateralBalance > requiredCollateral ? collateralBalance - requiredCollateral : 0n;
	const hasAnyStrategy = strategies[StrategyKey.HIGHER_PRICE] || strategies[StrategyKey.REPAY_LOAN];

	const delta = BigInt(deltaAmount || 0);
	const showStrategyOptions = !isIncrease && delta > maxRemovableWithoutAdjustment && currentDebt > 0n;
	const needsStrategy = showStrategyOptions && !hasAnyStrategy;

	const newCollateral = isIncrease ? collateralBalance + delta : collateralBalance - delta;
	const isClosingPosition = !isIncrease && newCollateral === 0n;

	const calculatedNewPrice = useMemo(() => {
		if (isIncrease || !strategies[StrategyKey.HIGHER_PRICE] || newCollateral === 0n) return positionPrice;
		return (currentDebt * BigInt(1e18)) / newCollateral + 1n;
	}, [isIncrease, strategies, newCollateral, currentDebt, positionPrice]);

	const calculatedRepayAmount = useMemo(() => {
		if (isIncrease || !strategies[StrategyKey.REPAY_LOAN]) return 0n;
		const debtNeededForNewCollateral = (positionPrice * newCollateral) / BigInt(1e18);
		const rawRepayAmount = currentDebt > debtNeededForNewCollateral ? currentDebt - debtNeededForNewCollateral : 0n;
		const withBuffer = (rawRepayAmount * 105n) / 100n;
		return withBuffer > currentDebt ? currentDebt : withBuffer;
	}, [isIncrease, strategies, newCollateral, currentDebt, positionPrice]);

	const newDebt = strategies[StrategyKey.REPAY_LOAN] ? currentDebt - calculatedRepayAmount : currentDebt;
	const newPrice = strategies[StrategyKey.HIGHER_PRICE] ? calculatedNewPrice : positionPrice;

	useEffect(() => {
		if (!deltaAmount) {
			setDeltaAmountError(null);
			return;
		}

		const delta = BigInt(deltaAmount || 0);
		const newCollateral = isIncrease ? collateralBalance + delta : collateralBalance - delta;
		const validationDebt = strategies[StrategyKey.REPAY_LOAN] ? currentDebt - calculatedRepayAmount : currentDebt;
		const formattedCurrentCollateral = formatCurrency(
			formatUnits(collateralBalance, collateralDecimals),
			0,
			getDisplayDecimals(collateralSymbol)
		);

		const validations = [
			{
				condition: !isIncrease && delta > collateralBalance,
				error: t("mint.error.amount_greater_than_position_balance"),
			},
			{
				condition: isIncrease && delta > walletBalance,
				error: t("common.error.insufficient_balance", { symbol: collateralSymbol }),
			},
			{
				condition: !isIncrease && strategies[StrategyKey.REPAY_LOAN] && calculatedRepayAmount > jusdBalance,
				error: t("mint.insufficient_balance", { symbol: position.stablecoinSymbol }),
			},
			{
				condition:
					!isIncrease &&
					!strategies[StrategyKey.REPAY_LOAN] &&
					newCollateral > 0n &&
					newCollateral < BigInt(position.minimumCollateral || 0) &&
					validationDebt > 0n,
				error: `${t("mint.error.collateral_below_min")} (${formattedCurrentCollateral} ${collateralSymbol})`,
			},
		];

		const error = validations.find((v) => v.condition)?.error ?? null;
		setDeltaAmountError(error);
	}, [
		deltaAmount,
		isIncrease,
		collateralBalance,
		walletBalance,
		collateralSymbol,
		strategies,
		calculatedRepayAmount,
		jusdBalance,
		position.stablecoinSymbol,
		position.minimumCollateral,
		t,
		currentDebt,
	]);

	const isBelowMinCollateral = (col: bigint) => col > 0n && col < BigInt(position.minimumCollateral || 0) && newDebt > 0n;

	const formatValue = (value: bigint) => formatPositionValue(value, collateralDecimals, collateralSymbol);

	const maxRemovable = hasAnyStrategy || maxRemovableWithoutAdjustment === 0n ? collateralBalance : maxRemovableWithoutAdjustment;

	const handleMaxClick = () => {
		const maxAmount = isIncrease ? walletBalance : maxRemovable;
		setDeltaAmount(maxAmount.toString());
	};

	const toggleStrategy = (key: StrategyKey) => setStrategies((prev) => ({ ...prev, [key]: !prev[key] }));

	const needsApproval = strategies[StrategyKey.REPAY_LOAN] && calculatedRepayAmount > 0n && jusdAllowance < calculatedRepayAmount;

	const handleApprove = async () => {
		if (!position || calculatedRepayAmount <= 0n) return;
		setIsTxOnGoing(true);
		const success = await approveToken({
			tokenAddress: position.stablecoinAddress as Address,
			spender: position.position as Address,
			amount: calculatedRepayAmount * 10n,
			t,
			onSuccess: refetchAllowance,
		});
		if (success) {
			await new Promise((resolve) => setTimeout(resolve, 1000));
			refetchAllowance();
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
		setIsTxOnGoing(false);
	};

	const handleExecute = async () => {
		if (!position || !userAddress || delta === 0n) return;
		if (needsStrategy) return;

		if (!strategies[StrategyKey.REPAY_LOAN] && isBelowMinCollateral(newCollateral)) {
			toast.error(t("mint.error.collateral_below_min"));
			return;
		}

		try {
			setIsTxOnGoing(true);

			if (isIncrease) {
				const adjustHash = await writeContract(WAGMI_CONFIG, {
					address: position.position as Address,
					abi: PositionV2ABI,
					functionName: "adjust",
					args: [principal, newCollateral, positionPrice, false],
					value: isNativeWrappedPosition ? delta : undefined,
				});

				const toastContent = [
					{ title: t("common.txs.amount"), value: formatValue(delta) },
					{ title: t("common.txs.transaction"), hash: adjustHash },
				];

				await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: adjustHash, confirmations: 1 }), {
					pending: { render: <TxToast title={t("mint.txs.adding_collateral")} rows={toastContent} /> },
					success: { render: <TxToast title={t("mint.txs.adding_collateral_success")} rows={toastContent} /> },
				});
			} else {
				if (newCollateral === 0n && principal > 0n && !strategies[StrategyKey.REPAY_LOAN]) {
					const repayHash = await writeContract(WAGMI_CONFIG, {
						address: position.position as Address,
						abi: PositionV2ABI,
						functionName: "repayFull",
					});
					await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: repayHash, confirmations: 1 }), {
						pending: {
							render: (
								<TxToast
									title={t("mint.txs.pay_back", { symbol: position.stablecoinSymbol })}
									rows={[{ title: t("common.txs.transaction"), hash: repayHash }]}
								/>
							),
						},
						success: {
							render: (
								<TxToast
									title={t("mint.txs.pay_back_success", { symbol: position.stablecoinSymbol })}
									rows={[{ title: t("common.txs.transaction"), hash: repayHash }]}
								/>
							),
						},
					});
				}

				if (strategies[StrategyKey.REPAY_LOAN] && calculatedRepayAmount > 0n) {
					const repayHash = await writeContract(WAGMI_CONFIG, {
						address: position.position as Address,
						abi: PositionV2ABI,
						functionName: "repay",
						args: [calculatedRepayAmount],
					});
					await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: repayHash, confirmations: 1 }), {
						pending: {
							render: (
								<TxToast
									title={t("mint.txs.pay_back", { symbol: position.stablecoinSymbol })}
									rows={[{ title: t("common.txs.transaction"), hash: repayHash }]}
								/>
							),
						},
						success: {
							render: (
								<TxToast
									title={t("mint.txs.pay_back_success", { symbol: position.stablecoinSymbol })}
									rows={[{ title: t("common.txs.transaction"), hash: repayHash }]}
								/>
							),
						},
					});
				}

				const isWithinDelta = delta <= maxRemovableWithoutAdjustment;
				const adjustDebt = isWithinDelta ? currentDebt : newDebt;
				const adjustPrice = isWithinDelta ? positionPrice : newPrice;

				const publicClient = getPublicClient(WAGMI_CONFIG);
				const estimatedGas =
					(await publicClient
						?.estimateContractGas({
							address: position.position as Address,
							abi: PositionV2ABI,
							functionName: "adjust",
							args: [adjustDebt, newCollateral, adjustPrice, isNativeWrappedPosition],
							account: userAddress,
						})
						.catch(() => 300_000n)) ?? 300_000n;

				const withdrawHash = await writeContract(WAGMI_CONFIG, {
					address: position.position as Address,
					abi: PositionV2ABI,
					functionName: "adjust",
					args: [adjustDebt, newCollateral, adjustPrice, isNativeWrappedPosition],
					gas: (estimatedGas * 150n) / 100n,
				});

				const toastContent = [
					{ title: t("common.txs.amount"), value: formatValue(delta) },
					{ title: t("common.txs.transaction"), hash: withdrawHash },
				];

				await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: withdrawHash, confirmations: 1 }), {
					pending: { render: <TxToast title={t("mint.txs.removing_collateral")} rows={toastContent} /> },
					success: { render: <TxToast title={t("mint.txs.removing_collateral_success")} rows={toastContent} /> },
				});
			}

			store.dispatch(fetchPositionsList());
			if (isClosingPosition) {
				router.push("/dashboard");
			} else {
				router.push(`/mint/${position.position}/manage`);
			}
		} catch (error) {
			toast.error(renderErrorTxToast(error));
		} finally {
			setIsTxOnGoing(false);
		}
	};

	const isDisabled =
		!deltaAmount ||
		delta === 0n ||
		Boolean(deltaAmountError) ||
		isTxOnGoing ||
		needsStrategy ||
		(!isIncrease && isInCooldown) ||
		(!isIncrease && collateralBalance <= requiredCollateral);

	const getButtonLabel = () => {
		if (needsApproval) return t("common.approve");
		if (delta === 0n) return isIncrease ? t("common.add") : t("common.remove");
		const formattedDelta = formatCurrency(formatUnits(delta, collateralDecimals), 0, getDisplayDecimals(collateralSymbol));
		if (strategies[StrategyKey.REPAY_LOAN] && calculatedRepayAmount > 0n) {
			const formattedRepay = formatCurrency(formatUnits(calculatedRepayAmount, 18), 0, 2);
			if (isClosingPosition) {
				return `${t("mint.repay")} ${formattedRepay} ${position.stablecoinSymbol}, ${t("common.remove")} & ${t(
					"mint.close_position"
				)}`;
			}
			return `${t("mint.repay")} ${formattedRepay} ${position.stablecoinSymbol} & ${t(
				"common.remove"
			)} ${formattedDelta} ${collateralSymbol}`;
		}
		if (strategies[StrategyKey.HIGHER_PRICE] && newPrice > positionPrice) {
			return t("mint.adjust_liq_price_btn");
		}
		return isIncrease
			? `${t("common.add")} ${formattedDelta} ${collateralSymbol}`
			: `${t("common.remove")} ${formattedDelta} ${collateralSymbol}`;
	};

	return (
		<div className="flex flex-col gap-y-4">
			<div className="flex flex-col gap-y-3">
				<div className="flex flex-row justify-between items-center">
					<div className="text-lg font-bold">
						{t("mint.adjust")} {t("mint.collateral")}
					</div>
					<div className="flex flex-row items-center">
						<SvgIconButton isSelected={isIncrease} onClick={() => setIsIncrease(true)} SvgComponent={AddCircleOutlineIcon}>
							{t("common.add")}
						</SvgIconButton>
						<SvgIconButton isSelected={!isIncrease} onClick={() => setIsIncrease(false)} SvgComponent={RemoveCircleOutlineIcon}>
							{t("common.remove")}
						</SvgIconButton>
					</div>
				</div>

				<NormalInputOutlined
					value={deltaAmount}
					onChange={setDeltaAmount}
					decimals={collateralDecimals}
					unit={collateralSymbol}
					isError={Boolean(deltaAmountError)}
					adornamentRow={
						<div className="self-stretch justify-start items-center inline-flex">
							<div className="grow shrink basis-0 h-4 px-2 justify-start items-center gap-2 flex max-w-full overflow-hidden"></div>
							<div className="h-7 justify-end items-center gap-2.5 flex">
								<div className="text-input-label text-xs font-medium leading-none">
									{formatCurrency(
										formatUnits(isIncrease ? walletBalance : maxRemovable, collateralDecimals),
										0,
										getDisplayDecimals(collateralSymbol)
									)}{" "}
									{collateralSymbol}
								</div>
								<MaxButton
									disabled={(isIncrease && walletBalance === 0n) || (!isIncrease && maxRemovable === 0n)}
									onClick={handleMaxClick}
								/>
							</div>
						</div>
					}
				/>
				{deltaAmountError && <div className="ml-1 text-text-muted2 text-sm">{deltaAmountError}</div>}
			</div>

			{showStrategyOptions && !hasAnyStrategy && (
				<div className="space-y-1 px-4">
					<div className="text-sm font-medium text-text-title">{t("mint.position_needs_adjustments")}</div>
					<div
						role="button"
						tabIndex={0}
						onClick={() => toggleStrategy(StrategyKey.REPAY_LOAN)}
						onKeyDown={(e) => e.key === "Enter" && toggleStrategy(StrategyKey.REPAY_LOAN)}
						className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
					>
						<div className="flex items-center gap-1">
							<span className="text-sm text-text-title">{t("mint.repay_loan")}</span>
							<Tooltip content={t("mint.tooltip_repay_loan")} arrow style="light">
								<span className="w-4 h-4 text-primary flex items-center">
									<AddCircleOutlineIcon color="currentColor" />
								</span>
							</Tooltip>
						</div>
					</div>
				</div>
			)}

			<div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
				{strategies[StrategyKey.HIGHER_PRICE] && newPrice > positionPrice && (
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
							{formatCurrency(formatUnits(newPrice, priceDecimals), 0, 0)} {position.stablecoinSymbol}
						</span>
					</div>
				)}
				{strategies[StrategyKey.REPAY_LOAN] && calculatedRepayAmount > 0n && (
					<div className="flex justify-between text-sm">
						<div className="flex items-center gap-1">
							<span className="text-text-muted2">{t("mint.repay_loan")}</span>
							<Tooltip content={t("mint.tooltip_remove_repay")} arrow style="light">
								<span
									className="w-4 h-4 text-primary cursor-pointer hover:opacity-80 flex items-center"
									onClick={() => toggleStrategy(StrategyKey.REPAY_LOAN)}
								>
									<RemoveCircleOutlineIcon color="currentColor" />
								</span>
							</Tooltip>
						</div>
						<span className="font-medium text-text-title">
							{formatCurrency(formatUnits(calculatedRepayAmount, 18), 0, 2)} {position.stablecoinSymbol}
						</span>
					</div>
				)}
				<div className="flex justify-between text-sm">
					<span className="text-text-muted2">{t("mint.current_collateral")}</span>
					<span className="font-medium text-text-title">
						{formatCurrency(formatUnits(collateralBalance, collateralDecimals), 0, getDisplayDecimals(collateralSymbol))}{" "}
						{collateralSymbol}
					</span>
				</div>
				<div className="flex justify-between text-sm">
					<span className="text-text-muted2">{t("mint.change")}</span>
					<span className="font-medium text-text-title">
						{isIncrease ? "+" : "-"}
						{formatCurrency(formatUnits(delta, collateralDecimals), 0, getDisplayDecimals(collateralSymbol))} {collateralSymbol}
					</span>
				</div>
				<div className="flex justify-between text-base pt-2 border-t border-gray-300 dark:border-gray-600">
					<span className="font-bold text-text-title">{t("mint.new_collateral")}</span>
					<span className="font-bold text-text-title">
						{formatCurrency(formatUnits(newCollateral, collateralDecimals), 0, getDisplayDecimals(collateralSymbol))}{" "}
						{collateralSymbol}
					</span>
				</div>
			</div>

			{!isIncrease && isInCooldown && (
				<div className="text-xs text-text-muted2 px-4">
					{t("mint.cooldown_please_wait", { remaining: cooldownRemainingFormatted })}
					<br />
					{t("mint.cooldown_ends_at", { date: cooldownEndsAt?.toLocaleString() })}
				</div>
			)}

			<Button
				className="w-full text-lg leading-snug !font-extrabold"
				onClick={needsApproval ? handleApprove : handleExecute}
				disabled={isDisabled}
				isLoading={isTxOnGoing}
			>
				{getButtonLabel()}
			</Button>
		</div>
	);
};
