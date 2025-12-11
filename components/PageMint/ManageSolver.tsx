import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "next-i18next";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import { RootState, store } from "../../redux/redux.store";
import { Address, formatUnits, zeroAddress, erc20Abi } from "viem";
import {
	formatCurrency,
	normalizeTokenSymbol,
	shortenAddress,
	getDisplayDecimals,
	formatPositionValue,
	formatPositionDelta,
	NATIVE_WRAPPED_SYMBOLS,
	formatDate,
	roundToWholeUnits,
} from "@utils";
import { useReadContracts, useChainId, useAccount } from "wagmi";
import { ADDRESS, PositionV2ABI } from "@juicedollar/jusd";
import { writeContract, waitForTransactionReceipt } from "wagmi/actions";
import { WAGMI_CONFIG } from "../../app.config";
import { toast } from "react-toastify";
import { TxToast, renderErrorTxToast } from "@components/TxToast";
import { fetchPositionsList } from "../../redux/slices/positions.slice";
import Button from "@components/Button";
import { SectionTitle } from "@components/SectionTitle";
import { Target, Strategy, solveManage, getStrategiesForTarget, SolverPosition, SolverOutcome } from "../../utils/positionSolver";
import { NormalInputOutlined } from "@components/Input/NormalInputOutlined";
import { SliderInputOutlined } from "@components/Input/SliderInputOutlined";
import { ExpirationManageSection } from "./ExpirationManageSection";
import { AddCircleOutlineIcon } from "@components/SvgComponents/add_circle_outline";
import { RemoveCircleOutlineIcon } from "@components/SvgComponents/remove_circle_outline";
import { SvgIconButton } from "./PlusMinusButtons";
import { getLoanDetailsByCollateralAndStartingLiqPrice } from "../../utils/loanCalculations";
import Link from "next/link";
import { useContractUrl } from "../../hooks/useContractUrl";
import AppBox from "@components/AppBox";
import DisplayLabel from "@components/DisplayLabel";
import DisplayAmount from "@components/DisplayAmount";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
import { MaxButton } from "@components/Input/MaxButton";
import { usePositionMaxAmounts } from "../../hooks/usePositionMaxAmounts";
import { ErrorDisplay } from "@components/ErrorDisplay";
import { ManageButtons } from "@components/ManageButtons";

type Step = "SELECT_TARGET" | "ENTER_VALUE" | "CHOOSE_STRATEGY" | "PREVIEW";

export const ManageSolver = () => {
	const { t } = useTranslation();
	const router = useRouter();
	const chainId = useChainId();
	const { address: addressQuery } = router.query;
	const { address: userAddress } = useAccount();

	const positions = useSelector((state: RootState) => state.positions.list?.list || []);
	const position = positions.find((p) => p.position == addressQuery);

	const { walletBalance } = usePositionMaxAmounts(position);

	const [step, setStep] = useState<Step>("SELECT_TARGET");
	const [selectedTarget, setSelectedTarget] = useState<Target | null>(null);
	const [deltaAmount, setDeltaAmount] = useState<string>("");
	const [isIncrease, setIsIncrease] = useState(true);
	const [newValue, setNewValue] = useState<string>("");
	const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
	const [outcome, setOutcome] = useState<SolverOutcome | null>(null);
	const [deltaAmountError, setDeltaAmountError] = useState<string | null>(null);
	const [isTxOnGoing, setIsTxOnGoing] = useState(false);

	const { data, refetch: refetchReadContracts } = useReadContracts({
		contracts: position
			? [
					{ chainId, address: position.position, abi: PositionV2ABI, functionName: "principal" },
					{ chainId, address: position.position, abi: PositionV2ABI, functionName: "price" },
					{
						chainId,
						abi: erc20Abi,
						address: position.collateral as Address,
						functionName: "balanceOf",
						args: [position.position],
					},
					{ chainId, abi: PositionV2ABI, address: position.position, functionName: "getDebt" },
					{ chainId, address: position.position, abi: PositionV2ABI, functionName: "cooldown" },
					{ chainId, address: position.position, abi: PositionV2ABI, functionName: "minimumCollateral" },
					{
						chainId,
						abi: erc20Abi,
						address: ADDRESS[chainId]?.juiceDollar as Address,
						functionName: "allowance",
						args: [userAddress as Address, position.position as Address],
					},
			  ]
			: [],
	});

	const principal = data?.[0]?.result || 0n;
	const liqPrice = data?.[1]?.result || 1n;
	const collateralBalance = data?.[2]?.result || 0n;
	const currentDebt = data?.[3]?.result || 0n;
	const cooldown = data?.[4]?.result || 0n;
	const minimumCollateral = data?.[5]?.result || 0n;
	const jusdAllowance = data?.[6]?.result || 0n;

	const now = BigInt(Math.floor(Date.now() / 1000));
	const cooldownBigInt = BigInt(cooldown);
	const isInCooldown = cooldownBigInt > now;
	const cooldownRemaining = isInCooldown ? Number(cooldownBigInt - now) : 0;
	const cooldownRemainingFormatted = isInCooldown
		? `${Math.floor(cooldownRemaining / 3600)}h ${Math.floor((cooldownRemaining % 3600) / 60)}m`
		: null;

	const getPriceRatio = (newPrice: bigint) => (liqPrice > 0n ? Number(newPrice) / Number(liqPrice) : 0);
	const isPriceTooHigh = (newPrice: bigint) => getPriceRatio(newPrice) > 2;
	const isBelowMinCollateral = (newCollateral: bigint) =>
		newCollateral > 0n && newCollateral < BigInt(minimumCollateral) && principal > 0n;
	const isInsufficientCollateral = (newCollateral: bigint, newDebt: bigint, newPrice: bigint) => {
		if (newDebt === 0n || newCollateral === 0n) return false;
		const collateralValue = newCollateral * newPrice;
		const debtRequired = newDebt * BigInt(1e18);
		return collateralValue < debtRequired;
	};
	const isUndercollateralizedAtCurrentPrice = (newCollateral: bigint, newPrice: bigint) => {
		if (newPrice <= liqPrice || principal === 0n) return false;
		const collateralValue = newCollateral * liqPrice;
		const debtRequired = principal * BigInt(1e18);
		return collateralValue < debtRequired;
	};

	const getRequiredRepayAmount = (outcome: SolverOutcome | null) => {
		if (!outcome || outcome.deltaDebt >= 0n) return 0n;
		return -outcome.deltaDebt;
	};

	const needsJusdApproval = (outcome: SolverOutcome | null) => {
		const repayAmount = getRequiredRepayAmount(outcome);
		return repayAmount > 0n && jusdAllowance < repayAmount;
	};

	const currentPosition: SolverPosition | null = useMemo(() => {
		if (!position) return null;
		return { collateral: collateralBalance, debt: currentDebt, liqPrice: liqPrice, expiration: position.expiration };
	}, [position, collateralBalance, currentDebt, liqPrice]);

	const priceDecimals = 36 - (position?.collateralDecimals || 18);

	const prices = useSelector((state: RootState) => state.prices.coingecko || {});
	const url = useContractUrl(position?.position || (zeroAddress as Address));
	const collateralPrice = prices[position?.collateral?.toLowerCase() as Address]?.price?.eur || 0;

	const loanDetails = useMemo(() => {
		if (!position || !collateralBalance || !liqPrice) return undefined;
		return getLoanDetailsByCollateralAndStartingLiqPrice(position, collateralBalance, liqPrice);
	}, [position, collateralBalance, liqPrice]);

	const getValueInfo = (target: Target) => {
		const info = {
			COLLATERAL: {
				value: collateralBalance,
				decimals: position?.collateralDecimals || 18,
				unit: normalizeTokenSymbol(position?.collateralSymbol || ""),
				displayDecimals: position?.collateralDecimals || 18,
			},
			LIQ_PRICE: { value: liqPrice, decimals: priceDecimals, unit: position?.stablecoinSymbol || "JUSD", displayDecimals: 0 },
			LOAN: { value: currentDebt, decimals: 18, unit: position?.stablecoinSymbol || "JUSD", displayDecimals: 18 },
			EXPIRATION: { value: 0n, decimals: 0, unit: "", displayDecimals: 0 },
		};
		return info[target];
	};

	useEffect(() => {
		setDeltaAmount("");
		setIsIncrease(true);
		setNewValue("");
		setSelectedStrategy(null);
		setOutcome(null);
	}, [selectedTarget]);

	useEffect(() => {
		if (!currentPosition || !selectedTarget || !newValue || !selectedStrategy) {
			setOutcome(null);
			return;
		}
		try {
			const value = selectedTarget === "EXPIRATION" ? Number(newValue) : BigInt(newValue);
			setOutcome(solveManage(currentPosition, selectedTarget, selectedStrategy, value));
		} catch (error) {
			setOutcome(null);
		}
	}, [currentPosition, selectedTarget, newValue, selectedStrategy]);

	useEffect(() => {
		if (step !== "ENTER_VALUE" || !selectedTarget || !deltaAmount) {
			setDeltaAmountError(null);
			return;
		}

		const delta = BigInt(deltaAmount || 0);

		if (!isIncrease && selectedTarget === "COLLATERAL" && delta > collateralBalance) {
			setDeltaAmountError(t("mint.error.amount_greater_than_position_balance"));
		} else {
			setDeltaAmountError(null);
		}
	}, [step, deltaAmount, isIncrease, selectedTarget, collateralBalance, t]);

	if (!position || !currentPosition) {
		return (
			<div className="flex justify-center items-center h-64">
				<span className="text-text-muted2">Loading...</span>
			</div>
		);
	}

	const formatValue = (value: bigint, target: Target) => {
		const { decimals, unit } = getValueInfo(target);
		return formatPositionValue(value, decimals, unit);
	};

	const formatDelta = (delta: bigint, target: Target) => {
		const { decimals, unit } = getValueInfo(target);
		return formatPositionDelta(delta, decimals, unit);
	};

	const getPreviewItems = (outcome: SolverOutcome) => [
		{ label: t("mint.collateral"), value: outcome.next.collateral, delta: outcome.deltaCollateral, target: "COLLATERAL" as Target },
		{ label: t("mint.liquidation_price"), value: outcome.next.liqPrice, delta: outcome.deltaLiqPrice, target: "LIQ_PRICE" as Target },
		{ label: t("mint.loan_amount"), value: outcome.next.debt, delta: outcome.deltaDebt, target: "LOAN" as Target },
	];

	const renderPreviewItems = (items: ReturnType<typeof getPreviewItems>) => (
		<div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600 space-y-3">
			{items.map((item, idx) => (
				<div key={idx} className="flex justify-between items-center">
					<span className="text-sm font-medium text-text-muted2">{item.label}</span>
					<div className="text-right">
						<div className="text-base font-bold text-text-title">{formatValue(item.value, item.target)}</div>
						<div className="text-xs text-text-muted3">{formatDelta(item.delta, item.target)}</div>
					</div>
				</div>
			))}
		</div>
	);

	const getActionLabel = (action: string) => {
		const labels = {
			DEPOSIT: t("mint.deposit_collateral"),
			WITHDRAW: t("mint.withdraw_collateral"),
			BORROW: t("mint.borrow_more"),
			REPAY: t("mint.repay_loan"),
		};
		return labels[action as keyof typeof labels] || "";
	};

	const getActionValue = (action: string, outcome: SolverOutcome) => {
		const values = {
			DEPOSIT: formatValue(outcome.deltaCollateral, "COLLATERAL"),
			WITHDRAW: formatValue(-outcome.deltaCollateral, "COLLATERAL"),
			BORROW: formatValue(outcome.deltaDebt, "LOAN"),
			REPAY: formatValue(-outcome.deltaDebt, "LOAN"),
		};
		return values[action as keyof typeof values] || "";
	};

	const handleReset = () => {
		setStep("SELECT_TARGET");
		setSelectedTarget(null);
		setNewValue("");
		setSelectedStrategy(null);
		setOutcome(null);
	};

	const isNativeWrappedPosition = position && NATIVE_WRAPPED_SYMBOLS.includes(position.collateralSymbol.toLowerCase());

	const handleApproveJusd = async () => {
		if (!position || !outcome) return;
		try {
			setIsTxOnGoing(true);
			const repayAmount = getRequiredRepayAmount(outcome);
			const approveHash = await writeContract(WAGMI_CONFIG, {
				address: ADDRESS[chainId]?.juiceDollar as Address,
				abi: erc20Abi,
				functionName: "approve",
				args: [position.position as Address, repayAmount * 2n],
			});

			const toastContent = [
				{
					title: t("common.txs.amount"),
					value: formatCurrency(formatUnits(repayAmount, 18)) + ` ${position.stablecoinSymbol}`,
				},
				{
					title: t("common.txs.transaction"),
					hash: approveHash,
				},
			];

			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: approveHash, confirmations: 1 }), {
				pending: {
					render: <TxToast title={t("common.txs.approving", { symbol: position.stablecoinSymbol })} rows={toastContent} />,
				},
				success: {
					render: <TxToast title={t("common.txs.success", { symbol: position.stablecoinSymbol })} rows={toastContent} />,
				},
			});
			await refetchReadContracts();
		} catch (error) {
			toast.error(renderErrorTxToast(error));
		} finally {
			setIsTxOnGoing(false);
		}
	};

	const handleExecute = async () => {
		if (!outcome || !outcome.isValid || !position) return;

		try {
			setIsTxOnGoing(true);

			const hasWithdraw = outcome.txPlan.includes("WITHDRAW");
			const withdrawHandlesRepay = hasWithdraw && outcome.deltaDebt < 0n;

			for (const action of outcome.txPlan) {
				if (action === "DEPOSIT") {
					const depositAmount = outcome.deltaCollateral;

					const adjustHash = await writeContract(WAGMI_CONFIG, {
						address: position.position,
						abi: PositionV2ABI,
						functionName: "adjust",
						args: [principal, outcome.next.collateral, outcome.next.liqPrice, false],
						value: isNativeWrappedPosition ? depositAmount : undefined,
					});

					const toastContent = [
						{
							title: t("common.txs.amount"),
							value: formatPositionValue(
								depositAmount,
								position.collateralDecimals,
								normalizeTokenSymbol(position.collateralSymbol)
							),
						},
						{
							title: t("common.txs.transaction"),
							hash: adjustHash,
						},
					];

					await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: adjustHash, confirmations: 1 }), {
						pending: {
							render: <TxToast title={t("mint.txs.adding_collateral")} rows={toastContent} />,
						},
						success: {
							render: <TxToast title={t("mint.txs.adding_collateral_success")} rows={toastContent} />,
						},
					});
				} else if (action === "WITHDRAW") {
					if (outcome.next.collateral === 0n && principal > 0n) {
						const repayHash = await writeContract(WAGMI_CONFIG, {
							address: position.position,
							abi: PositionV2ABI,
							functionName: "repayFull",
						});

						const repayToastContent = [
							{
								title: t("common.txs.transaction"),
								hash: repayHash,
							},
						];

						await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: repayHash, confirmations: 1 }), {
							pending: {
								render: (
									<TxToast
										title={t("mint.txs.pay_back", { symbol: position.stablecoinSymbol })}
										rows={repayToastContent}
									/>
								),
							},
							success: {
								render: (
									<TxToast
										title={t("mint.txs.pay_back_success", { symbol: position.stablecoinSymbol })}
										rows={repayToastContent}
									/>
								),
							},
						});
					}

					const withdrawHash = await writeContract(WAGMI_CONFIG, {
						address: position.position,
						abi: PositionV2ABI,
						functionName: "adjust",
						args: [outcome.next.debt, outcome.next.collateral, outcome.next.liqPrice, isNativeWrappedPosition],
					});

					const toastContent = [
						{
							title: t("common.txs.amount"),
							value: formatPositionValue(
								-outcome.deltaCollateral,
								position.collateralDecimals,
								normalizeTokenSymbol(position.collateralSymbol)
							),
						},
						{
							title: t("common.txs.transaction"),
							hash: withdrawHash,
						},
					];

					await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: withdrawHash, confirmations: 1 }), {
						pending: {
							render: <TxToast title={t("mint.txs.removing_collateral")} rows={toastContent} />,
						},
						success: {
							render: <TxToast title={t("mint.txs.removing_collateral_success")} rows={toastContent} />,
						},
					});
				} else if (action === "BORROW") {
					const borrowHash = await writeContract(WAGMI_CONFIG, {
						address: position.position,
						abi: PositionV2ABI,
						functionName: "mint",
						args: [userAddress as Address, outcome.deltaDebt],
					});

					const toastContent = [
						{
							title: t("common.txs.amount"),
							value: formatPositionValue(outcome.deltaDebt, 18, position.stablecoinSymbol),
						},
						{
							title: t("common.txs.transaction"),
							hash: borrowHash,
						},
					];

					await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: borrowHash, confirmations: 1 }), {
						pending: {
							render: <TxToast title={t("mint.txs.minting", { symbol: position.stablecoinSymbol })} rows={toastContent} />,
						},
						success: {
							render: (
								<TxToast title={t("mint.txs.minting_success", { symbol: position.stablecoinSymbol })} rows={toastContent} />
							),
						},
					});
				} else if (action === "REPAY") {
					if (withdrawHandlesRepay) continue;
					const repayAmount = -outcome.deltaDebt;

					let repayHash: `0x${string}`;

					if (outcome.next.debt === 0n) {
						repayHash = await writeContract(WAGMI_CONFIG, {
							address: position.position,
							abi: PositionV2ABI,
							functionName: "repayFull",
						});
					} else {
						repayHash = await writeContract(WAGMI_CONFIG, {
							address: position.position,
							abi: PositionV2ABI,
							functionName: "repay",
							args: [repayAmount],
						});
					}

					const toastContent = [
						{
							title: t("common.txs.amount"),
							value: formatPositionValue(repayAmount, 18, position.stablecoinSymbol),
						},
						{
							title: t("common.txs.transaction"),
							hash: repayHash,
						},
					];

					await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: repayHash, confirmations: 1 }), {
						pending: {
							render: <TxToast title={t("mint.txs.pay_back", { symbol: position.stablecoinSymbol })} rows={toastContent} />,
						},
						success: {
							render: (
								<TxToast
									title={t("mint.txs.pay_back_success", { symbol: position.stablecoinSymbol })}
									rows={toastContent}
								/>
							),
						},
					});
				}
			}

			await refetchReadContracts();
			store.dispatch(fetchPositionsList());
			handleReset();
		} catch (error) {
			toast.error(renderErrorTxToast(error));
		} finally {
			setIsTxOnGoing(false);
		}
	};
	if (step === "SELECT_TARGET") {
		const targets = [
			{
				id: "COLLATERAL" as const,
				label: t("mint.collateral"),
				desc: t("mint.adjust_collateral_description"),
				value: collateralBalance,
				decimals: position.collateralDecimals,
				currency: normalizeTokenSymbol(position.collateralSymbol),
			},
			{
				id: "LIQ_PRICE" as const,
				label: t("mint.liquidation_price"),
				desc: t("mint.adjust_liq_price_description"),
				value: liqPrice,
				decimals: priceDecimals,
				currency: position.stablecoinSymbol,
			},
			{
				id: "LOAN" as const,
				label: t("mint.loan_amount"),
				desc: t("mint.adjust_loan_amount_description"),
				value: currentDebt,
				decimals: 18,
				currency: position.stablecoinSymbol,
			},
			{
				id: "EXPIRATION" as const,
				label: t("mint.expiration"),
				desc: t("mint.adjust_expiration_description"),
				value: null,
				decimals: 0,
				currency: "",
			},
		];

		const handleConfirm = () => {
			if (!selectedTarget) return;
			setStep(selectedTarget === "EXPIRATION" ? "PREVIEW" : "ENTER_VALUE");
		};

		// Get dynamic button text based on selection
		const getButtonText = () => {
			if (!selectedTarget) return t("mint.adjust_position");

			switch (selectedTarget) {
				case "COLLATERAL":
					return `${t("mint.adjust")} ${t("mint.collateral")}`;
				case "LIQ_PRICE":
					return `${t("mint.adjust")} ${t("mint.liquidation_price")}`;
				case "LOAN":
					return `${t("mint.adjust")} ${t("mint.loan_amount")}`;
				case "EXPIRATION":
					return `${t("mint.adjust")} ${t("mint.expiration")}`;
				default:
					return t("mint.adjust_position");
			}
		};

		return (
			<div className="flex flex-col gap-y-4">
				<Link href={url} target="_blank">
					<div className="text-lg font-bold underline text-center">
						{t("monitoring.position")} {shortenAddress(position.position)}
						<FontAwesomeIcon icon={faArrowUpRightFromSquare} className="w-3 ml-2" />
					</div>
				</Link>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
					{targets.map((target) => (
						<button
							key={target.id}
							onClick={() => setSelectedTarget(target.id)}
							className="text-left hover:opacity-80 transition-opacity"
						>
							<AppBox
								className={`h-full transition-all ${
									selectedTarget === target.id
										? "ring-2 ring-orange-300 bg-orange-50 dark:bg-orange-900/10"
										: "hover:ring-2 hover:ring-orange-300"
								}`}
							>
								<DisplayLabel label={target.label} />
								{target.value !== null ? (
									<DisplayAmount
										amount={target.value}
										currency={target.currency}
										digits={target.decimals}
										className="mt-2"
									/>
								) : (
									<div className="mt-2">
										<b>{formatDate(position.expiration)}</b>
									</div>
								)}
							</AppBox>
						</button>
					))}
				</div>

				<div className="text-center">
					<p className="text-sm text-text-muted2">{t("mint.select_parameter_to_modify")}</p>
				</div>

				<Button onClick={handleConfirm} disabled={!selectedTarget} className="text-lg leading-snug !font-extrabold">
					{getButtonText()}
				</Button>
			</div>
		);
	}
	if (selectedTarget === "EXPIRATION" && step === "PREVIEW") {
		return (
			<div className="flex flex-col gap-y-4">
				<button onClick={handleReset} className="text-left text-primary hover:text-primary-hover text-sm font-medium">
					← {t("common.back")}
				</button>
				<SectionTitle className="!mb-0 !text-lg">{t("mint.expiration")}</SectionTitle>
				<ExpirationManageSection />
			</div>
		);
	}

	if (step === "ENTER_VALUE") {
		const { value: currentValue, decimals, unit } = getValueInfo(selectedTarget!);
		const delta = BigInt(deltaAmount || 0);
		const calculatedNewValue = isIncrease ? currentValue + delta : currentValue - delta;

		const getAdjustTitle = () => {
			switch (selectedTarget) {
				case "COLLATERAL":
					return `${t("mint.adjust")} ${t("mint.collateral")}`;
				case "LIQ_PRICE":
					return `${t("mint.adjust")} ${t("mint.liquidation_price")}`;
				case "LOAN":
					return `${t("mint.adjust")} ${t("mint.loan_amount")}`;
				default:
					return t("mint.enter_change_amount");
			}
		};

		const handleMaxClick = () => {
			const maxAmounts = {
				COLLATERAL: isIncrease ? walletBalance : currentValue,
				LOAN: currentValue,
				LIQ_PRICE: currentValue,
				EXPIRATION: 0n,
			};

			const maxAmount = maxAmounts[selectedTarget as keyof typeof maxAmounts] || 0n;
			setDeltaAmount(maxAmount.toString());
		};

		return (
			<div className="flex flex-col gap-y-6">
				<div className="flex flex-col gap-y-3">
					<div className="flex flex-row justify-between items-center">
						<div className="text-lg font-bold">{getAdjustTitle()}</div>
						<div className="flex flex-col sm:flex-row justify-end items-start sm:items-center">
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

					{selectedTarget === "LIQ_PRICE" ? (
						<SliderInputOutlined
							value={deltaAmount}
							onChange={(val) => setDeltaAmount(roundToWholeUnits(val, priceDecimals))}
							min={0n}
							max={liqPrice}
							decimals={priceDecimals}
							isError={Boolean(deltaAmountError)}
							hideTrailingZeros
						/>
					) : (
						<NormalInputOutlined
							value={deltaAmount}
							onChange={setDeltaAmount}
							decimals={decimals}
							unit={unit}
							isError={Boolean(deltaAmountError)}
							adornamentRow={
								<div className="self-stretch justify-start items-center inline-flex">
									<div className="grow shrink basis-0 h-4 px-2 justify-start items-center gap-2 flex max-w-full overflow-hidden"></div>
									<div className="h-7 justify-end items-center gap-2.5 flex">
										<div className="text-input-label text-xs font-medium leading-none">
											{formatUnits(
												isIncrease && selectedTarget === "COLLATERAL" ? walletBalance : currentValue,
												decimals
											)}{" "}
											{unit}
										</div>
										<MaxButton
											disabled={
												(isIncrease && selectedTarget === "COLLATERAL" && walletBalance === 0n) ||
												(!isIncrease && currentValue === 0n)
											}
											onClick={handleMaxClick}
										/>
									</div>
								</div>
							}
						/>
					)}
					<ErrorDisplay error={deltaAmountError} />
				</div>

				<div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
					<div className="flex justify-between text-sm">
						<span className="text-text-muted2">{t("mint.current_value")}</span>
						<span className="font-medium text-text-title">
							{formatCurrency(formatUnits(currentValue, decimals), 0, getDisplayDecimals(unit))} {unit}
						</span>
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-text-muted2">{t("mint.change")}</span>
						<span className="font-medium text-text-title">
							{isIncrease ? "+" : "-"}
							{formatCurrency(formatUnits(delta, decimals), 0, getDisplayDecimals(unit))} {unit}
						</span>
					</div>
					<div className="flex justify-between text-base pt-2 border-t border-gray-300 dark:border-gray-600">
						<span className="font-bold text-text-title">{t("mint.new_collateral")}</span>
						<span className="font-bold text-text-title">
							{formatCurrency(formatUnits(calculatedNewValue, decimals), 0, getDisplayDecimals(unit))} {unit}
						</span>
					</div>
				</div>

				<ManageButtons
					onBack={handleReset}
					onAction={() => {
						setNewValue(calculatedNewValue.toString());
						setStep("CHOOSE_STRATEGY");
					}}
					actionLabel={isIncrease ? t("common.add") : t("common.remove")}
					disabled={!deltaAmount || delta === 0n || Boolean(deltaAmountError)}
				/>
			</div>
		);
	}
	if (step === "CHOOSE_STRATEGY") {
		const { value: currentValue } = getValueInfo(selectedTarget!);
		const allStrategies = getStrategiesForTarget(selectedTarget!, BigInt(newValue) > currentValue);

		const hasNoDebt = currentDebt === 0n || currentDebt < 1000n;
		const isRemovingCollateral = selectedTarget === "COLLATERAL" && BigInt(newValue) < currentValue;

		const strategies = allStrategies.filter((strat) => {
			if (hasNoDebt && isRemovingCollateral && strat.strategy === "KEEP_LIQ_PRICE") {
				return false;
			}
			return true;
		});

		const getStrategyOutcome = (strategy: Strategy) => {
			if (!currentPosition || !selectedTarget || !newValue) return null;
			try {
				const value = selectedTarget === "EXPIRATION" ? Number(newValue) : BigInt(newValue);
				return solveManage(currentPosition, selectedTarget, strategy, value);
			} catch (error) {
				return null;
			}
		};

		return (
			<div className="flex flex-col gap-y-6">
				<div className="flex flex-col gap-4">
					{strategies.map((strat) => {
						const strategyOutcome = getStrategyOutcome(strat.strategy);
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
									<div className="text-sm font-semibold text-primary mb-4">{strat.consequence}</div>

									{isSelected && strategyOutcome?.isValid && renderPreviewItems(getPreviewItems(strategyOutcome))}
								</AppBox>
							</button>
						);
					})}
				</div>

				<div className="text-center">
					<p className="text-sm text-text-muted2">{t("mint.choose_what_stays_constant")}</p>
				</div>

				<ManageButtons
					onBack={() => setStep("ENTER_VALUE")}
					onAction={() => setStep("PREVIEW")}
					actionLabel={t("mint.preview_changes")}
					disabled={!selectedStrategy}
				/>
			</div>
		);
	}

	if (step === "PREVIEW" && outcome) {
		return (
			<div className="flex flex-col gap-y-6">
				{isInCooldown && outcome.next.liqPrice > liqPrice && (
					<AppBox className="ring-2 ring-orange-300 bg-orange-50 dark:bg-orange-900/10">
						<div className="text-sm text-text-title font-medium">
							Position in cooldown - Price increases blocked for: <strong>{cooldownRemainingFormatted}</strong>
						</div>
						<div className="text-xs text-text-muted2 mt-1">
							Ends: {new Date(Number(cooldownBigInt) * 1000).toLocaleString()}
						</div>
					</AppBox>
				)}

				{isPriceTooHigh(outcome.next.liqPrice) && (
					<AppBox className="ring-2 ring-red-300 bg-red-50 dark:bg-red-900/10">
						<div className="text-sm text-text-title font-medium">Price increase exceeds 2x limit</div>
						<div className="text-xs text-text-muted2 mt-1">
							Max allowed: {formatCurrency(formatUnits(liqPrice * 2n, priceDecimals), 0)} JUSD (current:{" "}
							{formatCurrency(formatUnits(liqPrice, priceDecimals), 0)} → new:{" "}
							{formatCurrency(formatUnits(outcome.next.liqPrice, priceDecimals), 0)})
						</div>
					</AppBox>
				)}

				{isBelowMinCollateral(outcome.next.collateral) && (
					<AppBox className="ring-2 ring-red-300 bg-red-50 dark:bg-red-900/10">
						<div className="text-sm text-text-title font-medium">Collateral below minimum</div>
						<div className="text-xs text-text-muted2 mt-1">
							Min required: {formatUnits(BigInt(minimumCollateral), position?.collateralDecimals || 18)}{" "}
							{normalizeTokenSymbol(position?.collateralSymbol || "")} (you have outstanding debt)
						</div>
					</AppBox>
				)}

				{isUndercollateralizedAtCurrentPrice(outcome.next.collateral, outcome.next.liqPrice) && (
					<AppBox className="ring-2 ring-red-300 bg-red-50 dark:bg-red-900/10">
						<div className="text-sm text-text-title font-medium">Insufficient collateral at current price</div>
						<div className="text-xs text-text-muted2 mt-1">
							Contract withdraws collateral BEFORE adjusting price. At current price (
							{formatCurrency(formatUnits(liqPrice, priceDecimals), 0)} JUSD),
							{formatUnits(outcome.next.collateral, position?.collateralDecimals || 18)}{" "}
							{normalizeTokenSymbol(position?.collateralSymbol || "")} is not enough to cover the debt.
						</div>
						<div className="text-xs text-text-muted3 mt-1">
							Try: Increase price first (triggers cooldown), then withdraw after cooldown ends.
						</div>
					</AppBox>
				)}

				{isInsufficientCollateral(outcome.next.collateral, outcome.next.debt, outcome.next.liqPrice) && (
					<AppBox className="ring-2 ring-red-300 bg-red-50 dark:bg-red-900/10">
						<div className="text-sm text-text-title font-medium">Insufficient collateral for new debt</div>
						<div className="text-xs text-text-muted2 mt-1">Collateral value too low. Add more collateral or borrow less.</div>
					</AppBox>
				)}

				{!outcome.isValid && (
					<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
						<div className="text-sm text-red-800 dark:text-red-200">{outcome.errorMessage || t("mint.calculation_error")}</div>
					</div>
				)}

				{outcome.isValid && (
					<>
						<div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
							{getPreviewItems(outcome).map((item, idx) => (
								<div key={idx} className="flex justify-between items-center">
									<span className="text-sm font-medium text-text-muted2">{item.label}</span>
									<div className="text-right">
										<div className="text-base font-bold text-text-title">{formatValue(item.value, item.target)}</div>
										<div className="text-xs text-text-muted3">{formatDelta(item.delta, item.target)}</div>
									</div>
								</div>
							))}
						</div>

						<div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
							<div className="text-sm font-medium text-text-title">{t("mint.required_actions")}:</div>
							{outcome.txPlan.map((action, idx) => (
								<div key={idx} className="flex justify-between items-center">
									<span className="text-sm font-medium text-text-muted2">{getActionLabel(action)}</span>
									<div className="text-right">
										<div className="text-base font-bold text-text-title">{getActionValue(action, outcome)}</div>
									</div>
								</div>
							))}
						</div>

						<div className="text-center text-sm text-text-muted2">{t("mint.execute_transaction_note")}</div>

						{needsJusdApproval(outcome) && (
							<AppBox className="ring-2 ring-orange-300 bg-orange-50 dark:bg-orange-900/10">
								<div className="text-sm text-text-title font-medium">Approval required</div>
								<div className="text-xs text-text-muted2 mt-1">
									Approve {formatCurrency(formatUnits(getRequiredRepayAmount(outcome), 18))} {position?.stablecoinSymbol}{" "}
									for repayment
								</div>
							</AppBox>
						)}

						<ManageButtons
							onBack={() => setStep("CHOOSE_STRATEGY")}
							onAction={needsJusdApproval(outcome) ? handleApproveJusd : handleExecute}
							actionLabel={needsJusdApproval(outcome) ? t("common.approve") : t("mint.confirm_execute")}
							isLoading={isTxOnGoing}
							disabled={
								(isInCooldown && outcome.next.liqPrice > liqPrice) ||
								isPriceTooHigh(outcome.next.liqPrice) ||
								isBelowMinCollateral(outcome.next.collateral) ||
								isUndercollateralizedAtCurrentPrice(outcome.next.collateral, outcome.next.liqPrice) ||
								isInsufficientCollateral(outcome.next.collateral, outcome.next.debt, outcome.next.liqPrice)
							}
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
