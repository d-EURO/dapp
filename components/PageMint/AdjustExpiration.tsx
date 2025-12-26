import { DateInputOutlined } from "@components/Input/DateInputOutlined";
import { MaxButton } from "@components/Input/MaxButton";
import { useTranslation } from "next-i18next";
import { useEffect, useState } from "react";
import { renderErrorTxToast } from "@components/TxToast";
import { waitForTransactionReceipt } from "wagmi/actions";
import { ADDRESS, PositionRollerABI, PositionV2ABI } from "@juicedollar/jusd";
import { useRouter } from "next/router";
import { writeContract } from "wagmi/actions";
import { WAGMI_CONFIG } from "../../app.config";
import { useChainId, useReadContracts } from "wagmi";
import { Address } from "viem/accounts";
import { getCarryOnQueryParams, toQueryString, toTimestamp, normalizeTokenSymbol, NATIVE_WRAPPED_SYMBOLS } from "@utils";
import { toast } from "react-toastify";
import { TxToast } from "@components/TxToast";
import { useWalletERC20Balances } from "../../hooks/useWalletBalances";
import { useExtensionTarget } from "../../hooks/useExtensionTarget";
import Button from "@components/Button";
import { erc20Abi, maxUint256 } from "viem";
import { PositionQuery } from "@juicedollar/api";

interface AdjustExpirationProps {
	position: PositionQuery;
}

export const AdjustExpiration = ({ position }: AdjustExpirationProps) => {
	const [expirationDate, setExpirationDate] = useState<Date | undefined | null>(undefined);
	const [isTxOnGoing, setIsTxOnGoing] = useState(false);
	const { t } = useTranslation();
	const chainId = useChainId();
	const router = useRouter();

	const isNativeWrappedPosition = NATIVE_WRAPPED_SYMBOLS.includes(position.collateralSymbol.toLowerCase());

	const { balancesByAddress, refetchBalances } = useWalletERC20Balances(
		position
			? [
					{
						symbol: position.collateralSymbol,
						address: position.collateral,
						name: position.collateralSymbol,
						allowance: [ADDRESS[chainId].roller],
					},
					{
						symbol: position.stablecoinSymbol,
						address: position.stablecoinAddress,
						name: position.stablecoinSymbol,
						allowance: [ADDRESS[chainId].roller],
					},
			  ]
			: []
	);

	const collateralAllowance = position ? balancesByAddress[position.collateral]?.allowance?.[ADDRESS[chainId].roller] : undefined;
	const jusdAllowance = position ? balancesByAddress[position.stablecoinAddress]?.allowance?.[ADDRESS[chainId].roller] : undefined;
	const jusdBalance = position ? balancesByAddress[position.stablecoinAddress]?.balanceOf : 0n;

	const { data: contractData } = useReadContracts({
		contracts: position
			? [
					{
						chainId,
						address: position.position,
						abi: PositionV2ABI,
						functionName: "principal",
					},
					{
						chainId,
						address: position.position,
						abi: PositionV2ABI,
						functionName: "getDebt",
					},
			  ]
			: [],
	});

	const principal = contractData?.[0]?.result || 0n;
	const currentDebt = contractData?.[1]?.result || 0n;

	const { targetPositionForExtend, canExtend } = useExtensionTarget(position, currentDebt);

	useEffect(() => {
		if (position) {
			if (targetPositionForExtend?.expiration) {
				setExpirationDate((date) => date ?? new Date(targetPositionForExtend.expiration * 1000));
			} else {
				setExpirationDate((date) => date ?? new Date(position.expiration * 1000));
			}
		}
	}, [position, targetPositionForExtend]);

	const currentExpirationDate = new Date(position.expiration * 1000);
	const isExtending = !!(expirationDate && expirationDate.getTime() > currentExpirationDate.getTime());

	const handleAdjustExpiration = async () => {
		try {
			setIsTxOnGoing(true);

			const newExpirationTimestamp = toTimestamp(expirationDate as Date);
			const target = targetPositionForExtend?.position;

			if (!target) {
				toast.error(t("mint.no_extension_target_available"));
				return;
			}

			let txHash: `0x${string}`;

			if (isNativeWrappedPosition) {
				txHash = await writeContract(WAGMI_CONFIG, {
					address: ADDRESS[chainId].roller,
					abi: PositionRollerABI,
					functionName: "rollFullyNativeWithExpiration",
					args: [position.position as Address, target as Address, newExpirationTimestamp],
					value: 0n,
				});
			} else {
				txHash = await writeContract(WAGMI_CONFIG, {
					address: ADDRESS[chainId].roller,
					abi: PositionRollerABI,
					functionName: "rollFullyWithExpiration",
					args: [position.position as Address, target as Address, newExpirationTimestamp],
				});
			}

			const toastContent = [
				{
					title: t("common.txs.transaction"),
					hash: txHash,
				},
			];

			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: txHash, confirmations: 1 }), {
				pending: {
					render: <TxToast title={t("mint.txs.extending")} rows={toastContent} />,
				},
				success: {
					render: <TxToast title={t("mint.txs.extending_success")} rows={toastContent} />,
				},
			});

			const carryOnQueryParams = getCarryOnQueryParams(router);
			const _href = `/dashboard${toQueryString(carryOnQueryParams)}`;
			router.push(_href);
		} catch (error) {
			toast.error(renderErrorTxToast(error));
		} finally {
			setIsTxOnGoing(false);
		}
	};

	const handleApproveCollateral = async () => {
		try {
			setIsTxOnGoing(true);

			const approvingHash = await writeContract(WAGMI_CONFIG, {
				address: position.collateral,
				abi: erc20Abi,
				functionName: "approve",
				args: [ADDRESS[chainId].roller, maxUint256],
			});

			const toastContent = [
				{
					title: t("common.txs.transaction"),
					hash: approvingHash,
				},
			];

			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: approvingHash, confirmations: 1 }), {
				pending: {
					render: (
						<TxToast
							title={t("common.txs.title", { symbol: normalizeTokenSymbol(position.collateralSymbol) })}
							rows={toastContent}
						/>
					),
				},
				success: {
					render: (
						<TxToast
							title={t("common.txs.success", { symbol: normalizeTokenSymbol(position.collateralSymbol) })}
							rows={toastContent}
						/>
					),
				},
			});

			await refetchBalances();
		} catch (error) {
			toast.error(renderErrorTxToast(error));
		} finally {
			setIsTxOnGoing(false);
		}
	};

	const handleApproveJusd = async () => {
		try {
			setIsTxOnGoing(true);

			const approvingHash = await writeContract(WAGMI_CONFIG, {
				address: position.stablecoinAddress,
				abi: erc20Abi,
				functionName: "approve",
				args: [ADDRESS[chainId].roller, maxUint256],
			});

			const toastContent = [
				{
					title: t("common.txs.transaction"),
					hash: approvingHash,
				},
			];

			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: approvingHash, confirmations: 1 }), {
				pending: {
					render: <TxToast title={t("common.txs.title", { symbol: position.stablecoinSymbol })} rows={toastContent} />,
				},
				success: {
					render: <TxToast title={t("common.txs.success", { symbol: position.stablecoinSymbol })} rows={toastContent} />,
				},
			});

			await refetchBalances();
		} catch (error) {
			toast.error(renderErrorTxToast(error));
		} finally {
			setIsTxOnGoing(false);
		}
	};

	const daysUntilExpiration = Math.ceil((currentExpirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
	const interest = currentDebt > principal ? currentDebt - principal : 0n;
	const hasInsufficientBalance = interest > 0n && BigInt(jusdBalance || 0) < interest;
	const formatNumber = (value: bigint, decimals: number = 18): string => {
		const num = Number(value) / Math.pow(10, decimals);
		return new Intl.NumberFormat(router?.locale || "en", {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(num);
	};

	return (
		<div className="flex flex-col gap-y-8">
			<div className="flex flex-col gap-y-1.5">
				<div className="text-lg font-extrabold leading-[1.4375rem]">{t("mint.current_expiration_date")}</div>
				<div className="text-base font-medium">
					{currentExpirationDate.toLocaleDateString(router?.locale || "en", { year: "numeric", month: "long", day: "numeric" })}
					{" - "}
					{daysUntilExpiration > 0
						? t("mint.days_until_expiration", { days: daysUntilExpiration })
						: daysUntilExpiration === 0
						? t("mint.expires_today")
						: t("mint.expired_days_ago", { days: Math.abs(daysUntilExpiration) })}
				</div>
				<div className="text-xs font-medium">{t("mint.extend_roll_borrowing_description")}</div>
			</div>
			<div className="flex flex-col gap-y-1.5">
				<div className="text-lg font-extrabold leading-[1.4375rem]">{t("mint.newly_selected_expiration_date")}</div>
				<DateInputOutlined
					minDate={currentExpirationDate}
					maxDate={
						canExtend && targetPositionForExtend?.expiration
							? new Date(targetPositionForExtend.expiration * 1000)
							: currentExpirationDate
					}
					value={expirationDate}
					placeholderText={new Date(position.expiration * 1000).toISOString().split("T")[0]}
					className="placeholder:text-[#5D647B]"
					onChange={setExpirationDate}
					rightAdornment={
						<MaxButton
							className="h-full py-3.5 px-3"
							onClick={() =>
								setExpirationDate(
									targetPositionForExtend?.expiration ? new Date(targetPositionForExtend.expiration * 1000) : undefined
								)
							}
							disabled={!targetPositionForExtend}
							label={t("common.max")}
						/>
					}
				/>
			</div>
			{!canExtend && <div className="text-xs text-text-muted2 px-4">{t("mint.no_extension_target_available")}</div>}
			{!isNativeWrappedPosition && !collateralAllowance ? (
				<Button
					className="text-lg leading-snug !font-extrabold"
					onClick={handleApproveCollateral}
					isLoading={isTxOnGoing}
					disabled={isTxOnGoing || !canExtend}
				>
					{t("common.approve")} {normalizeTokenSymbol(position.collateralSymbol)}
				</Button>
			) : !jusdAllowance ? (
				<Button
					className="text-lg leading-snug !font-extrabold"
					onClick={handleApproveJusd}
					isLoading={isTxOnGoing}
					disabled={isTxOnGoing || !canExtend}
				>
					{t("common.approve")} {position.stablecoinSymbol}
				</Button>
			) : (
				<>
					{isExtending && expirationDate && (
						<div className="text-sm font-medium text-center">
							{t("mint.extending_by_days", {
								days: Math.ceil((expirationDate.getTime() - currentExpirationDate.getTime()) / (1000 * 60 * 60 * 24)),
							})}
						</div>
					)}
					{interest > 0n && (
						<div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
							<div className="flex justify-between items-center">
								<span className="text-sm font-medium text-gray-600 dark:text-gray-400">
									{t("mint.outstanding_interest")}
								</span>
								<span className="text-lg font-bold text-gray-900 dark:text-gray-100">
									{formatNumber(interest)} {position.stablecoinSymbol}
								</span>
							</div>
							<div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
								{t("mint.current_debt", { amount: formatNumber(currentDebt), symbol: position.stablecoinSymbol })}{" "}
								{t("mint.original_amount", { amount: formatNumber(principal), symbol: position.stablecoinSymbol })}
							</div>
							{hasInsufficientBalance && (
								<div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
									<div className="text-xs font-medium text-red-600 dark:text-red-400">
										{t("mint.insufficient_balance", { symbol: position.stablecoinSymbol })}
									</div>
									<div className="text-xs text-red-500 dark:text-red-500 mt-1">
										{t("mint.you_have", {
											amount: formatNumber(BigInt(jusdBalance || 0)),
											symbol: position.stablecoinSymbol,
										})}
										<br />
										{t("mint.you_need", { amount: formatNumber(interest), symbol: position.stablecoinSymbol })}
									</div>
								</div>
							)}
						</div>
					)}
					<Button
						className="text-lg leading-snug !font-extrabold"
						onClick={handleAdjustExpiration}
						isLoading={isTxOnGoing}
						disabled={isTxOnGoing || !expirationDate || !isExtending || !canExtend || hasInsufficientBalance}
					>
						{t("mint.extend_roll_borrowing")}{" "}
						{expirationDate &&
							`to ${expirationDate.toLocaleDateString(router?.locale || "en", {
								year: "numeric",
								month: "short",
								day: "numeric",
							})}`}
					</Button>
				</>
			)}
		</div>
	);
};
