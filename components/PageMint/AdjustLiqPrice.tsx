import { useState, useEffect } from "react";
import { useTranslation } from "next-i18next";
import { formatUnits } from "viem";
import { formatCurrency, roundToWholeUnits } from "@utils";
import { SliderInputOutlined } from "@components/Input/SliderInputOutlined";
import { AddCircleOutlineIcon } from "@components/SvgComponents/add_circle_outline";
import { RemoveCircleOutlineIcon } from "@components/SvgComponents/remove_circle_outline";
import { SvgIconButton } from "./PlusMinusButtons";
import { ManageButtons } from "@components/ManageButtons";
import AppBox from "@components/AppBox";
import { PositionQuery } from "@juicedollar/api";
import { Strategy, solveManage, getStrategiesForTarget, SolverPosition, SolverOutcome, TxAction } from "../../utils/positionSolver";
import { Target } from "./AdjustPosition";
import { useChainId, useAccount } from "wagmi";
import { ADDRESS, PositionV2ABI } from "@juicedollar/jusd";
import { writeContract, waitForTransactionReceipt } from "wagmi/actions";
import { WAGMI_CONFIG } from "../../app.config";
import { toast } from "react-toastify";
import { TxToast, renderErrorTxToast } from "@components/TxToast";
import { store } from "../../redux/redux.store";
import { fetchPositionsList } from "../../redux/slices/positions.slice";
import { Address, erc20Abi } from "viem";

enum Step {
	ENTER_VALUE = "ENTER_VALUE",
	CHOOSE_STRATEGY = "CHOOSE_STRATEGY",
	PREVIEW = "PREVIEW",
}

interface AdjustLiqPriceProps {
	position: PositionQuery;
	liqPrice: bigint;
	priceDecimals: number;
	jusdAllowance: bigint;
	currentPosition: SolverPosition;
	isInCooldown: boolean;
	cooldownRemainingFormatted: string | null;
	cooldownEndsAt?: Date;
	refetch: () => void;
	onBack: () => void;
	onSuccess: () => void;
}

export const AdjustLiqPrice = ({
	position,
	liqPrice,
	priceDecimals,
	jusdAllowance,
	currentPosition,
	isInCooldown,
	cooldownRemainingFormatted,
	cooldownEndsAt,
	refetch,
	onBack,
	onSuccess,
}: AdjustLiqPriceProps) => {
	const { t } = useTranslation();
	const chainId = useChainId();
	const { address: userAddress } = useAccount();

	const [step, setStep] = useState<Step>(Step.ENTER_VALUE);
	const [deltaAmount, setDeltaAmount] = useState<string>("");
	const [isIncrease, setIsIncrease] = useState(true);
	const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
	const [outcome, setOutcome] = useState<SolverOutcome | null>(null);
	const [isTxOnGoing, setIsTxOnGoing] = useState(false);

	const delta = BigInt(deltaAmount || 0);
	const newLiqPrice = isIncrease ? liqPrice + delta : liqPrice - delta;

	useEffect(() => {
		if (!selectedStrategy || step !== Step.PREVIEW) {
			setOutcome(null);
			return;
		}
		try {
			setOutcome(solveManage(currentPosition, Target.LIQ_PRICE, selectedStrategy, newLiqPrice));
		} catch {
			setOutcome(null);
		}
	}, [currentPosition, selectedStrategy, newLiqPrice, step]);

	const isPriceTooHigh = (price: bigint) => liqPrice > 0n && Number(price) / Number(liqPrice) > 2;

	const getRequiredRepayAmount = () => {
		if (!outcome || outcome.deltaDebt >= 0n) return 0n;
		return -outcome.deltaDebt;
	};

	const needsApproval = () => {
		const repayAmount = getRequiredRepayAmount();
		return repayAmount > 0n && jusdAllowance < repayAmount;
	};

	const handleApprove = async () => {
		if (!outcome) return;
		try {
			setIsTxOnGoing(true);
			const repayAmount = getRequiredRepayAmount();
			const hash = await writeContract(WAGMI_CONFIG, {
				address: ADDRESS[chainId]?.juiceDollar as Address,
				abi: erc20Abi,
				functionName: "approve",
				args: [position.position as Address, repayAmount * 2n],
			});
			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash, confirmations: 1 }), {
				pending: { render: <TxToast title={t("common.txs.approving", { symbol: position.stablecoinSymbol })} rows={[]} /> },
				success: { render: <TxToast title={t("common.txs.success", { symbol: position.stablecoinSymbol })} rows={[]} /> },
			});
			refetch();
		} catch (error) {
			toast.error(renderErrorTxToast(error));
		} finally {
			setIsTxOnGoing(false);
		}
	};

	const handleExecute = async () => {
		if (!outcome || !outcome.isValid || !userAddress) return;
		try {
			setIsTxOnGoing(true);

			if (outcome.deltaDebt < 0n) {
				const repayAmount = -outcome.deltaDebt;
				const repayHash = await writeContract(WAGMI_CONFIG, {
					address: position.position as Address,
					abi: PositionV2ABI,
					functionName: "repay",
					args: [repayAmount],
				});
				await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: repayHash, confirmations: 1 }), {
					pending: { render: <TxToast title={t("mint.txs.pay_back", { symbol: position.stablecoinSymbol })} rows={[]} /> },
					success: {
						render: <TxToast title={t("mint.txs.pay_back_success", { symbol: position.stablecoinSymbol })} rows={[]} />,
					},
				});
			}

			const adjustHash = await writeContract(WAGMI_CONFIG, {
				address: position.position as Address,
				abi: PositionV2ABI,
				functionName: "adjust",
				args: [outcome.next.debt, outcome.next.collateral, outcome.next.liqPrice, false],
			});
			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: adjustHash, confirmations: 1 }), {
				pending: { render: <TxToast title={t("mint.txs.adjusting_price")} rows={[]} /> },
				success: { render: <TxToast title={t("mint.txs.adjusting_price_success")} rows={[]} /> },
			});

			store.dispatch(fetchPositionsList());
			refetch();
			onSuccess();
		} catch (error) {
			toast.error(renderErrorTxToast(error));
		} finally {
			setIsTxOnGoing(false);
		}
	};

	const handleReset = () => {
		setStep(Step.ENTER_VALUE);
		setDeltaAmount("");
		setSelectedStrategy(null);
		setOutcome(null);
	};

	if (step === Step.ENTER_VALUE) {
		return (
			<div className="flex flex-col gap-y-4">
				<div className="flex flex-col gap-y-3">
					<div className="flex flex-row justify-between items-center">
						<div className="text-lg font-bold">
							{t("mint.adjust")} {t("mint.liquidation_price")}
						</div>
						<div className="flex flex-row items-center">
							<SvgIconButton isSelected={isIncrease} onClick={() => setIsIncrease(true)} SvgComponent={AddCircleOutlineIcon}>
								{t("common.add")}
							</SvgIconButton>
							<SvgIconButton
								isSelected={!isIncrease}
								onClick={() => setIsIncrease(false)}
								SvgComponent={RemoveCircleOutlineIcon}
							>
								{t("common.remove")}
							</SvgIconButton>
						</div>
					</div>

					<SliderInputOutlined
						value={deltaAmount}
						onChange={(val) => setDeltaAmount(roundToWholeUnits(val, priceDecimals))}
						min={0n}
						max={liqPrice}
						decimals={priceDecimals}
						isError={false}
						hideTrailingZeros
					/>
				</div>

				<div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
					<div className="flex justify-between text-sm">
						<span className="text-text-muted2">{t("mint.current_liquidation_price")}</span>
						<span className="font-medium text-text-title">
							{formatCurrency(formatUnits(liqPrice, priceDecimals), 0, 0)} {position.stablecoinSymbol}
						</span>
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-text-muted2">{t("mint.change")}</span>
						<span className="font-medium text-text-title">
							{isIncrease ? "+" : "-"}
							{formatCurrency(formatUnits(delta, priceDecimals), 0, 0)} {position.stablecoinSymbol}
						</span>
					</div>
					<div className="flex justify-between text-base pt-2 border-t border-gray-300 dark:border-gray-600">
						<span className="font-bold text-text-title">{t("mint.new_liq_price")}</span>
						<span className="font-bold text-text-title">
							{formatCurrency(formatUnits(newLiqPrice, priceDecimals), 0, 0)} {position.stablecoinSymbol}
						</span>
					</div>
				</div>

				<ManageButtons
					onBack={onBack}
					onAction={() => setStep(Step.CHOOSE_STRATEGY)}
					actionLabel={t("common.continue")}
					disabled={delta === 0n}
				/>
			</div>
		);
	}

	if (step === Step.CHOOSE_STRATEGY) {
		const strategies = getStrategiesForTarget(Target.LIQ_PRICE, isIncrease);

		const getStrategyOutcome = (strategy: Strategy) => {
			try {
				return solveManage(currentPosition, Target.LIQ_PRICE, strategy, newLiqPrice);
			} catch {
				return null;
			}
		};

		return (
			<div className="flex flex-col gap-y-4">
				<div className="flex flex-col gap-4">
					{strategies.map((strat) => {
						const stratOutcome = getStrategyOutcome(strat.strategy);
						const isSelected = selectedStrategy === strat.strategy;

						return (
							<button
								key={strat.strategy}
								onClick={() => setSelectedStrategy(strat.strategy)}
								className="text-left hover:opacity-80 transition-opacity"
							>
								<AppBox
									className={`h-full transition-all ${
										isSelected
											? "ring-2 ring-orange-300 bg-orange-50 dark:bg-orange-900/10"
											: "hover:ring-2 hover:ring-orange-300"
									}`}
								>
									<div className="text-lg font-bold text-text-title mb-2">{strat.label}</div>
									<div className="text-sm text-text-muted2 mb-2">{strat.description}</div>
									<div className="text-sm font-semibold text-primary">{strat.consequence}</div>
									{isSelected && stratOutcome?.isValid && (
										<div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600 space-y-2">
											<div className="flex justify-between text-sm">
												<span className="text-text-muted2">{t("mint.collateral")}</span>
												<span className="font-medium">
													{formatCurrency(
														formatUnits(stratOutcome.next.collateral, position.collateralDecimals),
														0,
														6
													)}
												</span>
											</div>
											<div className="flex justify-between text-sm">
												<span className="text-text-muted2">{t("mint.loan_amount")}</span>
												<span className="font-medium">
													{formatCurrency(formatUnits(stratOutcome.next.debt, 18), 0, 2)}{" "}
													{position.stablecoinSymbol}
												</span>
											</div>
										</div>
									)}
								</AppBox>
							</button>
						);
					})}
				</div>

				<div className="text-center">
					<p className="text-sm text-text-muted2">{t("mint.choose_what_stays_constant")}</p>
				</div>

				<ManageButtons
					onBack={() => setStep(Step.ENTER_VALUE)}
					onAction={() => setStep(Step.PREVIEW)}
					actionLabel={t("mint.preview_changes")}
					disabled={!selectedStrategy}
				/>
			</div>
		);
	}

	if (step === Step.PREVIEW && outcome) {
		const isDisabled = (isInCooldown && outcome.next.liqPrice > liqPrice) || isPriceTooHigh(outcome.next.liqPrice) || !outcome.isValid;

		return (
			<div className="flex flex-col gap-y-4">
				{isInCooldown && outcome.next.liqPrice > liqPrice && (
					<AppBox className="ring-2 ring-orange-300 bg-orange-50 dark:bg-orange-900/10">
						<div className="text-sm text-text-title font-medium">
							{t("mint.cooldown_please_wait", { remaining: cooldownRemainingFormatted })}
						</div>
						<div className="text-xs text-text-muted2 mt-1">
							{t("mint.cooldown_ends_at", { date: cooldownEndsAt?.toLocaleString() })}
						</div>
					</AppBox>
				)}

				{isPriceTooHigh(outcome.next.liqPrice) && (
					<AppBox className="ring-2 ring-red-300 bg-red-50 dark:bg-red-900/10">
						<div className="text-sm text-text-title font-medium">{t("mint.price_increase_exceeds_limit")}</div>
						<div className="text-xs text-text-muted2 mt-1">
							Max: {formatCurrency(formatUnits(liqPrice * 2n, priceDecimals), 0, 0)} {position.stablecoinSymbol}
						</div>
					</AppBox>
				)}

				{!outcome.isValid && (
					<AppBox className="ring-2 ring-red-300 bg-red-50 dark:bg-red-900/10">
						<div className="text-sm text-text-title font-medium">{outcome.errorMessage || t("mint.calculation_error")}</div>
					</AppBox>
				)}

				{outcome.isValid && (
					<>
						<div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
							<div className="flex justify-between text-sm">
								<span className="text-text-muted2">{t("mint.liquidation_price")}</span>
								<div className="text-right">
									<div className="font-bold">
										{formatCurrency(formatUnits(outcome.next.liqPrice, priceDecimals), 0, 0)}{" "}
										{position.stablecoinSymbol}
									</div>
									<div className="text-xs text-text-muted3">
										{outcome.deltaLiqPrice >= 0n ? "+" : ""}
										{formatCurrency(formatUnits(outcome.deltaLiqPrice, priceDecimals), 0, 0)}
									</div>
								</div>
							</div>
							<div className="flex justify-between text-sm">
								<span className="text-text-muted2">{t("mint.collateral")}</span>
								<div className="text-right">
									<div className="font-bold">
										{formatCurrency(formatUnits(outcome.next.collateral, position.collateralDecimals), 0, 6)}
									</div>
									<div className="text-xs text-text-muted3">
										{outcome.deltaCollateral >= 0n ? "+" : ""}
										{formatCurrency(formatUnits(outcome.deltaCollateral, position.collateralDecimals), 0, 6)}
									</div>
								</div>
							</div>
							<div className="flex justify-between text-sm">
								<span className="text-text-muted2">{t("mint.loan_amount")}</span>
								<div className="text-right">
									<div className="font-bold">
										{formatCurrency(formatUnits(outcome.next.debt, 18), 0, 2)} {position.stablecoinSymbol}
									</div>
									<div className="text-xs text-text-muted3">
										{outcome.deltaDebt >= 0n ? "+" : ""}
										{formatCurrency(formatUnits(outcome.deltaDebt, 18), 0, 2)}
									</div>
								</div>
							</div>
						</div>

						{needsApproval() && (
							<AppBox className="ring-2 ring-orange-300 bg-orange-50 dark:bg-orange-900/10">
								<div className="text-sm text-text-title font-medium">{t("common.approval_required")}</div>
								<div className="text-xs text-text-muted2 mt-1">
									{formatCurrency(formatUnits(getRequiredRepayAmount(), 18), 0, 2)} {position.stablecoinSymbol}
								</div>
							</AppBox>
						)}

						<ManageButtons
							onBack={() => setStep(Step.CHOOSE_STRATEGY)}
							onAction={needsApproval() ? handleApprove : handleExecute}
							actionLabel={needsApproval() ? t("common.approve") : t("mint.confirm_execute")}
							isLoading={isTxOnGoing}
							disabled={isDisabled}
						/>
					</>
				)}

				<button onClick={handleReset} className="text-center text-text-muted2 hover:text-text-title text-sm">
					{t("mint.start_over")}
				</button>
			</div>
		);
	}

	return null;
};
