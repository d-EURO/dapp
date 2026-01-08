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
import { useReferencePosition } from "../../hooks/useReferencePosition";

interface AdjustLiqPriceProps {
	position: PositionQuery;
	positionPrice: bigint;
	liqPrice: bigint;
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
	liqPrice,
	priceDecimals,
	currentPosition,
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
	const newPrice = isIncrease ? liqPrice + delta : liqPrice - delta;

	const minPriceForDecrease = (currentPosition.debt * BigInt(1e18)) / currentPosition.collateral;
	const deltaDecrease = liqPrice > minPriceForDecrease ? ((liqPrice - minPriceForDecrease) * 99n) / 100n : 0n;
	const maxDeltaDecrease = deltaDecrease * 10n >= liqPrice ? deltaDecrease : 0n;

	const reference = useReferencePosition(position, positionPrice);

	const maxPriceIncrease = liqPrice * 2n;
	const maxAllowedPrice = reference.price <= maxPriceIncrease ? reference.price : maxPriceIncrease;
	const deltaIncrease = maxAllowedPrice > liqPrice ? maxAllowedPrice - liqPrice : 0n;
	const maxDeltaIncrease = deltaIncrease * 10n >= liqPrice ? deltaIncrease : 0n;
	const hasValidReference = reference.address !== null && maxDeltaIncrease > 0n;

	const isDecreaseInvalid = !isIncrease && delta > maxDeltaDecrease;

	const pairNotation = `${normalizeTokenSymbol(position.collateralSymbol)}/${position.stablecoinSymbol}`;

	useEffect(() => {
		setDeltaAmount("");
	}, [isIncrease]);

	useEffect(() => {
		if (!hasValidReference) {
			setIsIncrease(false);
		}
	}, [hasValidReference]);

	const handleExecute = async () => {
		if (!userAddress || delta === 0n) return;
		try {
			setIsTxOnGoing(true);

			const adjustHash = isIncrease
				? await writeContract(WAGMI_CONFIG, {
						address: position.position as Address,
						abi: PositionV2ABI,
						functionName: "adjustPriceWithReference",
						args: [newPrice, reference.address!],
				  })
				: await writeContract(WAGMI_CONFIG, {
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

	const isDisabled = delta === 0n || isDecreaseInvalid;

	return (
		<div className="flex flex-col gap-y-4">
			<div className="flex flex-col gap-y-3">
				<div className="flex flex-row justify-between items-center">
					<div className="text-lg font-bold">
						{t("mint.adjust")} {t("mint.liquidation_price")}
					</div>
					<div className="flex flex-row items-center">
						{maxDeltaIncrease > 0n && (
							<SvgIconButton isSelected={isIncrease} onClick={() => setIsIncrease(true)} SvgComponent={AddCircleOutlineIcon}>
								{t("mint.increase")}
							</SvgIconButton>
						)}
						{maxDeltaDecrease > 0n && (
							<SvgIconButton
								isSelected={!isIncrease}
								onClick={() => setIsIncrease(false)}
								SvgComponent={RemoveCircleOutlineIcon}
							>
								{t("mint.decrease")}
							</SvgIconButton>
						)}
					</div>
				</div>

				{(maxDeltaIncrease > 0n || maxDeltaDecrease > 0n) && (
					<SliderInputOutlined
						value={deltaAmount}
						onChange={(val) => setDeltaAmount(roundToWholeUnits(val, priceDecimals))}
						min={0n}
						max={isIncrease ? maxDeltaIncrease : maxDeltaDecrease}
						decimals={priceDecimals}
						hideTrailingZeros
					/>
				)}
			</div>

			{!hasValidReference && maxDeltaDecrease === 0n && (
				<div className="text-sm text-text-muted2 px-4">
					{t("mint.position_at_limit")}{" "}
					<button
						onClick={() => router.push(`/mint/${position.position}/manage/collateral`)}
						className="text-primary underline hover:opacity-80"
					>
						{t("common.add")} {t("mint.collateral")}
					</button>{" "}
					{t("common.or")}{" "}
					<button
						onClick={() => router.push(`/mint/${position.position}/manage/loan`)}
						className="text-primary underline hover:opacity-80"
					>
						{t("mint.repay_debt")}
					</button>{" "}
					{t("mint.to_adjust_price")}
				</div>
			)}

			<div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
				<div className="flex justify-between text-sm">
					<span className="text-text-muted2">{t("mint.current_liquidation_price")}</span>
					<span className="font-medium text-text-title">
						{formatCurrency(formatUnits(positionPrice, priceDecimals), 0, 0)} {pairNotation}
					</span>
				</div>
				<div className="flex justify-between text-sm">
					<span className="text-text-muted2">{t("mint.change")}</span>
					<span className="font-medium text-text-title">
						{isIncrease ? "+" : "-"}
						{formatCurrency(formatUnits(delta, priceDecimals), 0, 0)} {pairNotation}
					</span>
				</div>
				<div className="flex justify-between text-base pt-2 border-t border-gray-300 dark:border-gray-600">
					<span className="font-bold text-text-title">{t("mint.new_liq_price")}</span>
					<span className="font-bold text-text-title">
						{formatCurrency(formatUnits(newPrice, priceDecimals), 0, 0)} {pairNotation}
					</span>
				</div>
			</div>

			<Button
				className="w-full text-lg leading-snug !font-extrabold"
				onClick={handleExecute}
				isLoading={isTxOnGoing}
				disabled={isDisabled}
			>
				{delta === 0n
					? t("mint.set_new_price")
					: `${t("mint.set_price_to")} ${formatCurrency(formatUnits(newPrice, priceDecimals), 0, 0)} ${pairNotation}`}
			</Button>
		</div>
	);
};
