import { useState, useEffect } from "react";
import { useTranslation } from "next-i18next";
import { useRouter } from "next/router";
import { formatUnits } from "viem";
import { formatCurrency, roundToWholeUnits, normalizeTokenSymbol } from "@utils";
import { SliderInputOutlined } from "@components/Input/SliderInputOutlined";
import { AddCircleOutlineIcon } from "@components/SvgComponents/add_circle_outline";
import { RemoveCircleOutlineIcon } from "@components/SvgComponents/remove_circle_outline";
import { SvgIconButton } from "./PlusMinusButtons";
import Button from "@components/Button";
import { PositionQuery } from "@juicedollar/api";
import { SolverPosition } from "../../utils/positionSolver";
import { useAccount } from "wagmi";
import { PositionV2ABI } from "@juicedollar/jusd";
import { writeContract, waitForTransactionReceipt } from "wagmi/actions";
import { WAGMI_CONFIG } from "../../app.config";
import { toast } from "react-toastify";
import { TxToast, renderErrorTxToast } from "@components/TxToast";
import { store } from "../../redux/redux.store";
import { fetchPositionsList } from "../../redux/slices/positions.slice";
import { Address } from "viem";

interface AdjustLiqPriceProps {
	position: PositionQuery;
	positionPrice: bigint;
	priceDecimals: number;
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
	positionPrice,
	priceDecimals,
	currentPosition,
	isInCooldown,
	cooldownRemainingFormatted,
	cooldownEndsAt,
	refetch,
	onSuccess,
}: AdjustLiqPriceProps) => {
	const { t } = useTranslation();
	const router = useRouter();
	const { address: userAddress } = useAccount();

	const [deltaAmount, setDeltaAmount] = useState<string>("");
	const [isIncrease, setIsIncrease] = useState(true);
	const [isTxOnGoing, setIsTxOnGoing] = useState(false);

	const delta = deltaAmount ? BigInt(deltaAmount) : 0n;
	const newPrice = isIncrease ? positionPrice + delta : positionPrice - delta;
	const minimumCollateral = BigInt(position.minimumCollateral);
	const minCollateralNeeded = newPrice > 0n ? (currentPosition.debt * BigInt(1e18)) / newPrice : 0n;

	const minRequired = minCollateralNeeded > minimumCollateral ? minCollateralNeeded : minimumCollateral;
	const collateralToRemove = isIncrease ? currentPosition.collateral - minRequired : 0n;

	const minPriceForDecrease = (currentPosition.debt * BigInt(1e18)) / currentPosition.collateral;
	const maxDeltaDecrease = positionPrice > minPriceForDecrease ? positionPrice - minPriceForDecrease : 0n;

	const isBlockedByCooldown = isInCooldown && isIncrease && delta > 0n;
	const isDecreaseInvalid = !isIncrease && delta > maxDeltaDecrease;

	useEffect(() => {
		setDeltaAmount("");
	}, [isIncrease]);

	const handleExecute = async () => {
		if (!userAddress || delta === 0n) return;
		try {
			setIsTxOnGoing(true);

			const adjustHash = await writeContract(WAGMI_CONFIG, {
				address: position.position as Address,
				abi: PositionV2ABI,
				functionName: "adjustPrice",
				args: [newPrice],
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

	const isDisabled = delta === 0n || isBlockedByCooldown || isDecreaseInvalid;

	return (
		<div className="flex flex-col gap-y-4">
			<div className="flex flex-col gap-y-3">
				<div className="flex flex-row justify-between items-center">
					<div className="text-lg font-bold">
						{t("mint.adjust")} {t("mint.liquidation_price")}
					</div>
					<div className="flex flex-row items-center">
						<SvgIconButton isSelected={isIncrease} onClick={() => setIsIncrease(true)} SvgComponent={AddCircleOutlineIcon}>
							{t("mint.increase")}
						</SvgIconButton>
						<SvgIconButton isSelected={!isIncrease} onClick={() => setIsIncrease(false)} SvgComponent={RemoveCircleOutlineIcon}>
							{t("mint.reduce")}
						</SvgIconButton>
					</div>
				</div>

				<SliderInputOutlined
					value={deltaAmount}
					onChange={(val) => setDeltaAmount(roundToWholeUnits(val, priceDecimals))}
					min={0n}
					max={isIncrease ? positionPrice : maxDeltaDecrease}
					decimals={priceDecimals}
					hideTrailingZeros
				/>
			</div>

			{isDecreaseInvalid && delta > 0n && (
				<div className="text-xs text-text-muted2 px-4">
					{t("mint.price_below_collateral_limit", {
						min: formatCurrency(formatUnits(minPriceForDecrease, priceDecimals), 0, 0),
						symbol: position.stablecoinSymbol,
					})}{" "}
					<button
						onClick={() => router.push(`/mint/${position.position}/manage/collateral`)}
						className="text-primary underline hover:opacity-80"
					>
						{t("common.add")} {t("mint.collateral")}
					</button>
				</div>
			)}

			<div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
				<div className="flex justify-between text-sm">
					<span className="text-text-muted2">{t("mint.current_liquidation_price")}</span>
					<span className="font-medium text-text-title">
						{formatCurrency(formatUnits(positionPrice, priceDecimals), 0, 0)} {position.stablecoinSymbol}
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
						{formatCurrency(formatUnits(newPrice, priceDecimals), 0, 0)} {position.stablecoinSymbol}
					</span>
				</div>
			</div>

			{isIncrease &&
				delta > 0n &&
				(isInCooldown ? (
					<div className="text-xs text-text-muted2 px-4">
						{t("mint.cooldown_please_wait", { remaining: cooldownRemainingFormatted })}
						<br />
						{t("mint.cooldown_ends_at", { date: cooldownEndsAt?.toLocaleString() })}
					</div>
				) : (
					<div className="text-xs text-text-muted2 px-4">
						{t("mint.price_increase_cooldown_warning")}
						{collateralToRemove > 0n && (
							<span>
								{" "}
								{t("mint.after_cooldown_can_withdraw", {
									amount: formatCurrency(formatUnits(collateralToRemove, position.collateralDecimals), 0, 6),
									symbol: normalizeTokenSymbol(position.collateralSymbol || ""),
								})}
							</span>
						)}
					</div>
				))}

			<Button
				className="w-full text-lg leading-snug !font-extrabold"
				onClick={handleExecute}
				isLoading={isTxOnGoing}
				disabled={isDisabled}
			>
				{delta === 0n
					? t("common.continue")
					: isIncrease
					? `${t("mint.increase")} ${formatCurrency(formatUnits(delta, priceDecimals), 0, 0)} ${position.stablecoinSymbol}`
					: `${t("mint.reduce")} ${formatCurrency(formatUnits(delta, priceDecimals), 0, 0)} ${position.stablecoinSymbol}`}
			</Button>
		</div>
	);
};
