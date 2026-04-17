import { DateInputOutlined } from "@components/Input/DateInputOutlined";
import { MaxButton } from "@components/Input/MaxButton";
import { InputTitle } from "@components/Input/InputTitle";
import { DetailsExpandablePanel } from "@components/PageMint/DetailsExpandablePanel";
import { useTranslation } from "next-i18next";
import { useEffect, useMemo, useState } from "react";
import { renderErrorTxToast, TxToast } from "@components/TxToast";
import { waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { PositionRollerV2ABI, PositionRollerV3ABI, PositionV2ABI, PositionV3ABI } from "@deuro/eurocoin";
import { useRouter } from "next/router";
import { WAGMI_CONFIG } from "../../app.config";
import { useAccount, useChainId, useReadContracts } from "wagmi";
import { Address, erc20Abi, maxUint256 } from "viem";
import {
	formatBigInt,
	formatDuration,
	getCarryOnQueryParams,
	shortenAddress,
	toQueryString,
	toTimestamp,
} from "@utils";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import { RootState } from "../../redux/redux.store";
import { useWalletERC20Balances } from "../../hooks/useWalletBalances";
import Button from "@components/Button";
import Link from "next/link";
import Select, { StylesConfig } from "react-select";
import { getAppAddresses } from "@contracts";
import { useContractUrl } from "../../hooks/useContractUrl";
import { getLoanDetailsByCollateralAndLiqPrice } from "../../utils/loanCalculations";
import { useNativeBalance } from "../../hooks/useNativeBalance";

type PriceOption = { value: string; label: string };

const selectStyles: StylesConfig<PriceOption, false> = {
	control: (base, state) => ({
		...base,
		backgroundColor: "#ffffff",
		borderRadius: "0.75rem",
		border: state.isFocused ? "2px solid #0D4E9C" : "1px solid #B7B7B7",
		boxShadow: "none",
		padding: "0.25rem 0.25rem",
		minHeight: "3rem",
		"&:hover": { borderColor: state.isFocused ? "#0D4E9C" : "#6D6D6D" },
	}),
	singleValue: (base) => ({
		...base,
		color: "#131313",
		fontSize: "0.9375rem",
		fontWeight: 500,
	}),
	menu: (base) => ({
		...base,
		backgroundColor: "#ffffff",
		borderRadius: "0.75rem",
		overflow: "hidden",
		border: "1px solid #B7B7B7",
		boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
		zIndex: 20,
	}),
	menuList: (base) => ({
		...base,
		padding: 0,
	}),
	option: (base, state) => ({
		...base,
		backgroundColor: state.isSelected ? "#E4F0FC" : state.isFocused ? "#F5F6F9" : "transparent",
		color: "#131313",
		fontSize: "0.9375rem",
		fontWeight: state.isSelected ? 600 : 400,
		padding: "0.625rem 0.75rem",
		cursor: "pointer",
		"&:active": { backgroundColor: "#E4F0FC" },
	}),
	indicatorSeparator: () => ({ display: "none" }),
	dropdownIndicator: (base) => ({
		...base,
		color: "#B7B7B7",
		"&:hover": { color: "#6D6D6D" },
	}),
};

const ceilDivPPM = (amount: bigint, ppm: bigint): bigint =>
	amount === 0n ? 0n : (amount * 1_000_000n - 1n) / (1_000_000n - ppm) + 1n;

const getNetDebt = (principal: bigint, interest: bigint, reserveContribution: number): bigint =>
	principal - (principal * BigInt(reserveContribution)) / 1_000_000n + interest;

export const ExpirationManageSection = () => {
	const [expirationDate, setExpirationDate] = useState<Date | undefined | null>(undefined);
	const [isTxOnGoing, setIsTxOnGoing] = useState(false);
	const [selectedTargetPrice, setSelectedTargetPrice] = useState<string | null>(null);
	const { t } = useTranslation();
	const chainId = useChainId();
	const ADDR = getAppAddresses(chainId);
	const { address: walletAddress } = useAccount();
	const { balance: nativeBalance } = useNativeBalance();

	const router = useRouter();
	const { address: positionAddress } = router.query;

	const positions = useSelector((state: RootState) => state.positions.list?.list || []);
	const openPositions = useSelector((state: RootState) => state.positions.openPositions || []);
	const position = positions.find((p) => p.position == positionAddress);
	const positionAbi = position?.version === 3 ? PositionV3ABI : PositionV2ABI;
	const rollerAbi = position?.version === 3 ? PositionRollerV3ABI : PositionRollerV2ABI;
	const rollerAddress = position?.version === 3 ? ADDR.rollerV3 : ADDR.rollerV2;
	const prices = useSelector((state: RootState) => state.prices.coingecko || {});
	const challenges = useSelector((state: RootState) => state.challenges.list?.list || []);
	const challengedPositions = useMemo(
		() => challenges.filter((c) => c.status === "Active").map((c) => c.position),
		[challenges]
	);

	const { balancesByAddress, refetchBalances } = useWalletERC20Balances(
		position
			? [
					{
						symbol: position.collateralSymbol,
						address: position.collateral,
						name: position.collateralSymbol,
						allowance: [rollerAddress],
					},
					{
						symbol: position.deuroSymbol,
						address: position.deuro,
						name: position.deuroSymbol,
						allowance: [rollerAddress],
					},
			  ]
			: []
	);

	const url = useContractUrl(position?.position || "");
	const isOwner = !!walletAddress && !!position && position.owner.toLowerCase() === walletAddress.toLowerCase();
	// Native-ETH UX (ETH labeling, native balance, skipped WETH approval, rollNative dispatch)
	// is only valid for V3: the V3 roller exposes rollNative/rollFullyNative; the V2 roller
	// does not. V2 WETH positions must use the ERC20 `roll` path with explicit WETH approval.
	const isNativeWrappedPosition = position?.collateralSymbol?.toLowerCase() === "weth" && position?.version === 3;
	const collateralSymbol = isNativeWrappedPosition ? "ETH" : position?.collateralSymbol || "";
	const priceDecimals = 36 - (position?.collateralDecimals || 18);

	const { targetsByPrice, availablePrices } = useMemo(() => {
		if (!position) return { targetsByPrice: new Map<string, (typeof openPositions)[number]>(), availablePrices: [] as string[] };

		const now = Date.now() / 1000;
		const eligible = openPositions
			.filter((p) => p.version === position.version)
			.filter((p) => p.collateral.toLowerCase() === position.collateral.toLowerCase())
			.filter((p) => p.cooldown < now)
			.filter((p) => p.expiration > now)
			.filter((p) => p.expiration > position.expiration)
			.filter((p) => BigInt(p.availableForClones) > 0n)
			.filter((p) => !p.closed)
			.filter((p) => !challengedPositions.includes(p.position));

		const grouped = new Map<string, (typeof openPositions)[number]>();
		for (const candidate of eligible) {
			const existing = grouped.get(candidate.price);
			if (!existing || candidate.expiration > existing.expiration) {
				grouped.set(candidate.price, candidate);
			}
		}

		const pricesByLevel = [...grouped.keys()].sort((a, b) => {
			const diff = BigInt(b) - BigInt(a);
			return diff > 0n ? 1 : diff < 0n ? -1 : 0;
		});

		return { targetsByPrice: grouped, availablePrices: pricesByLevel };
	}, [challengedPositions, openPositions, position]);

	const { data: sourceContractData } = useReadContracts({
		contracts: position
			? [
					{
						chainId,
						address: position.position,
						abi: positionAbi,
						functionName: "principal",
					},
					{
						chainId,
						address: position.position,
						abi: positionAbi,
						functionName: "getDebt",
					},
					{
						chainId,
						address: position.collateral as Address,
						abi: erc20Abi,
						functionName: "balanceOf",
						args: [position.position as Address],
					},
					{
						chainId,
						address: position.position,
						abi: positionAbi,
						functionName: "reserveContribution",
					},
			  ]
			: [],
	});

	const principal = (sourceContractData?.[0]?.result as bigint | undefined) ?? 0n;
	const currentDebt = (sourceContractData?.[1]?.result as bigint | undefined) ?? 0n;
	const sourceCollateralBalance = (sourceContractData?.[2]?.result as bigint | undefined) ?? 0n;
	const sourceReservePPM = BigInt(sourceContractData?.[3]?.result ?? position?.reserveContribution ?? 0);
	const sourcePrice = BigInt(position?.price ?? 0);

	const defaultPrice = useMemo(() => {
		const safePrices = availablePrices.filter((price) => BigInt(price) >= sourcePrice);
		if (safePrices.length > 0) return safePrices[safePrices.length - 1];
		return availablePrices[0] ?? null;
	}, [availablePrices, sourcePrice]);

	const effectivePrice = selectedTargetPrice ?? defaultPrice;
	const selectedTarget = effectivePrice ? targetsByPrice.get(effectivePrice) ?? null : null;

	const { data: targetContractData } = useReadContracts({
		contracts: selectedTarget
			? [
					{
						chainId,
						address: selectedTarget.position as Address,
						abi: positionAbi,
						functionName: "reserveContribution",
					},
					{
						chainId,
						address: selectedTarget.position as Address,
						abi: positionAbi,
						functionName: "price",
					},
					{
						chainId,
						address: selectedTarget.position as Address,
						abi: positionAbi,
						functionName: "minimumCollateral",
					},
			  ]
			: [],
	});

	const targetReservePPM = BigInt(targetContractData?.[0]?.result ?? selectedTarget?.reserveContribution ?? 0);
	const targetPrice = BigInt(targetContractData?.[1]?.result ?? selectedTarget?.price ?? 0);
	const targetMinimumCollateral = BigInt(targetContractData?.[2]?.result ?? selectedTarget?.minimumCollateral ?? 0);

	useEffect(() => {
		if (selectedTargetPrice && !availablePrices.includes(selectedTargetPrice)) {
			setSelectedTargetPrice(null);
		}
	}, [availablePrices, selectedTargetPrice]);

	useEffect(() => {
		if (!selectedTarget) return;
		setExpirationDate((current) => {
			const targetExpiration = new Date(selectedTarget.expiration * 1000);
			if (!current) return targetExpiration;
			if (current.getTime() > targetExpiration.getTime()) return targetExpiration;
			return current;
		});
	}, [selectedTarget]);

	const currentExpirationDate = new Date((position?.expiration ?? Math.floor(Date.now() / 1000)) * 1000);
	const isExtending = !!expirationDate && expirationDate.getTime() > currentExpirationDate.getTime();
	const interest = currentDebt > principal ? currentDebt - principal : 0n;
	const netDebt = getNetDebt(principal, interest, position?.reserveContribution ?? 0);
	const deuroAllowance = position ? balancesByAddress[position.deuro]?.allowance?.[rollerAddress] : undefined;
	const deuroBalance = position ? balancesByAddress[position.deuro]?.balanceOf || 0n : 0n;
	const collateralAllowance = position ? balancesByAddress[position.collateral]?.allowance?.[rollerAddress] : undefined;
	const walletCollateralBalance = position
		? isNativeWrappedPosition
			? nativeBalance
			: BigInt(balancesByAddress[position.collateral]?.balanceOf || 0)
		: 0n;
	const cooldownTimestamp = BigInt(position?.cooldown ?? 0);
	const nowTimestamp = BigInt(Math.floor(Date.now() / 1000));
	const isInCooldown = cooldownTimestamp > nowTimestamp && cooldownTimestamp < 32508005122n;
	const cooldownRemaining = isInCooldown ? formatDuration(cooldownTimestamp - nowTimestamp) : null;
	const loanDetails = position
		? getLoanDetailsByCollateralAndLiqPrice(position, BigInt(position.collateralBalance), BigInt(position.price))
		: null;
	const collateralPrice = position ? prices?.[position.collateral.toLowerCase() as Address]?.price?.usd || 0 : 0;
	const noTargetsAvailable = availablePrices.length === 0;
	const daysUntilExpiration = Math.ceil((currentExpirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

	const rollParams = useMemo(() => {
		if (!position || !selectedTarget || sourceCollateralBalance === 0n || sourceReservePPM === 0n) return null;

		const interestBuffer = interest / 10n + BigInt(1e16);
		const repayAmount = principal + interest + interestBuffer;
		const usableMint = (principal * (1_000_000n - sourceReservePPM)) / 1_000_000n + interest;

		let mintAmount = ceilDivPPM(usableMint, targetReservePPM);
		let depositAmount = targetPrice > 0n ? (mintAmount * 10n ** 18n + targetPrice - 1n) / targetPrice : 0n;

		if (depositAmount > sourceCollateralBalance) {
			depositAmount = sourceCollateralBalance;
			mintAmount = (depositAmount * targetPrice) / 10n ** 18n;
		}

		if (depositAmount < targetMinimumCollateral) {
			depositAmount = targetMinimumCollateral;
		}

		const extraCollateral = depositAmount > sourceCollateralBalance ? depositAmount - sourceCollateralBalance : 0n;

		return {
			repay: repayAmount,
			collWithdraw: sourceCollateralBalance,
			mint: mintAmount,
			collDeposit: depositAmount,
			extraCollateral,
		};
	}, [interest, position, principal, selectedTarget, sourceCollateralBalance, sourceReservePPM, targetMinimumCollateral, targetPrice, targetReservePPM]);

	const totalCost = useMemo(() => {
		if (!position || !rollParams || !selectedTarget) return interest;

		const assignedReserve = (sourceReservePPM * principal) / 1_000_000n;
		const mintNet = (rollParams.mint * (1_000_000n - targetReservePPM)) / 1_000_000n;
		const surplus = rollParams.repay - (interest + (principal - assignedReserve));
		const totalReceived = surplus + mintNet;

		return rollParams.repay > totalReceived ? rollParams.repay - totalReceived : 0n;
	}, [interest, position, principal, rollParams, selectedTarget, sourceReservePPM, targetReservePPM]);

	if (!position || !loanDetails) {
		return (
			<div className="flex justify-center items-center h-64">
				<span className="text-text-muted2">Loading position data...</span>
			</div>
		);
	}

	const priceAdjustmentCost = totalCost > interest ? totalCost - interest : 0n;
	const displayedInterest = totalCost < interest ? totalCost : interest;
	// The roller transfers (repay - used) back to the caller before burnFrom(repay),
	// so the wallet only needs `totalCost` (= used - mintNet). The dust term absorbs
	// interest accrual between UI calc and on-chain execution.
	const totalCostWithBuffer = totalCost + BigInt(1e16);
	const hasInsufficientBalance = totalCostWithBuffer > 0n && deuroBalance < totalCostWithBuffer;
	const hasInsufficientCollateral = !!rollParams && rollParams.extraCollateral > 0n && walletCollateralBalance < rollParams.extraCollateral;

	const formatAmount = (value: bigint, decimals = 18) =>
		new Intl.NumberFormat(router.locale || "en", {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(Number(value) / 10 ** decimals);

	const formatPrice = (rawPrice: string) => formatBigInt(BigInt(rawPrice), priceDecimals, 2);

	const handleAdjustExpiration = async () => {
		if (!selectedTarget || !rollParams || !expirationDate) return;

		try {
			setIsTxOnGoing(true);

			const args = [
				position.position as Address,
				rollParams.repay,
				rollParams.collWithdraw,
				selectedTarget.position as Address,
				rollParams.mint,
				rollParams.collDeposit,
				toTimestamp(expirationDate),
			] as const;

			const txHash = isNativeWrappedPosition
				? await writeContract(WAGMI_CONFIG, {
						address: rollerAddress,
						abi: rollerAbi,
						functionName: "rollNative",
						args,
						value: rollParams.extraCollateral,
				  })
				: await writeContract(WAGMI_CONFIG, {
						address: rollerAddress,
						abi: rollerAbi,
						functionName: "roll",
						args,
				  });

			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: txHash, confirmations: 1 }), {
				pending: {
					render: <TxToast title={t("mint.txs.extending")} rows={[{ title: t("common.txs.transaction"), hash: txHash }]} />,
				},
				success: {
					render: <TxToast title={t("mint.txs.extending_success")} rows={[{ title: t("common.txs.transaction"), hash: txHash }]} />,
				},
			});

			router.push(`/dashboard${toQueryString(getCarryOnQueryParams(router))}`);
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
				args: [rollerAddress, maxUint256],
			});

			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: approvingHash, confirmations: 1 }), {
				pending: {
					render: <TxToast title={t("common.txs.title", { symbol: position.collateralSymbol })} rows={[{ title: t("common.txs.transaction"), hash: approvingHash }]} />,
				},
				success: {
					render: <TxToast title={t("common.txs.success", { symbol: position.collateralSymbol })} rows={[{ title: t("common.txs.transaction"), hash: approvingHash }]} />,
				},
			});

			await refetchBalances();
		} catch (error) {
			toast.error(renderErrorTxToast(error));
		} finally {
			setIsTxOnGoing(false);
		}
	};

	const handleApproveDeuro = async () => {
		try {
			setIsTxOnGoing(true);

			const approvingHash = await writeContract(WAGMI_CONFIG, {
				address: position.deuro,
				abi: erc20Abi,
				functionName: "approve",
				args: [rollerAddress, maxUint256],
			});

			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: approvingHash, confirmations: 1 }), {
				pending: {
					render: <TxToast title={t("common.txs.title", { symbol: position.deuroSymbol })} rows={[{ title: t("common.txs.transaction"), hash: approvingHash }]} />,
				},
				success: {
					render: <TxToast title={t("common.txs.success", { symbol: position.deuroSymbol })} rows={[{ title: t("common.txs.transaction"), hash: approvingHash }]} />,
				},
			});

			await refetchBalances();
		} catch (error) {
			toast.error(renderErrorTxToast(error));
		} finally {
			setIsTxOnGoing(false);
		}
	};

	return (
		<div className="flex flex-col gap-y-6">
			<div className="grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-4">
				<div>
					<div className="text-xs text-text-muted2">{t("mint.total")}</div>
					<div className="text-sm font-bold text-text-title">
						{formatAmount(netDebt)} {position.deuroSymbol}
					</div>
				</div>
				<div>
					<div className="text-xs text-text-muted2">{t("common.liquidation_price")}</div>
					<div className="text-sm font-bold text-text-title">
						{formatBigInt(sourcePrice, priceDecimals, 2)} {position.deuroSymbol}/{collateralSymbol}
					</div>
				</div>
				<div>
					<div className="text-xs text-text-muted2">{t("monitoring.collateral")}</div>
					<div className="text-sm font-bold text-text-title">
						{formatAmount(sourceCollateralBalance, position.collateralDecimals)} {collateralSymbol}
					</div>
				</div>
				<div>
					<div className="text-xs text-text-muted2">{t("mint.expiration")}</div>
					<div className="text-sm font-bold text-text-title">
						{currentExpirationDate.toLocaleDateString(router.locale || "en", {
							month: "short",
							day: "numeric",
							year: "numeric",
						})}
						<span className="text-xs font-normal text-text-muted2 ml-1">
							(
							{daysUntilExpiration > 0
								? t("mint.days_until_expiration", { days: daysUntilExpiration })
								: daysUntilExpiration === 0
								? t("mint.expires_today")
								: t("mint.expired_days_ago", { days: Math.abs(daysUntilExpiration) })}
							)
						</span>
					</div>
				</div>
			</div>

			<div className="flex flex-col gap-y-1.5">
				<InputTitle>{t("common.liquidation_price")}</InputTitle>
				{noTargetsAvailable ? (
					<div className="text-sm text-text-muted2 px-1">{t("mint.no_extension_target_available")}</div>
				) : (
					<Select<PriceOption>
						options={availablePrices.map((price) => ({
							value: price,
							label: `${formatPrice(price)} ${position.deuroSymbol}/${collateralSymbol}`,
						}))}
						value={
							effectivePrice
								? {
										value: effectivePrice,
										label: `${formatPrice(effectivePrice)} ${position.deuroSymbol}/${collateralSymbol}`,
								  }
								: null
						}
						onChange={(option) => {
							if (!option) return;
							setSelectedTargetPrice(option.value);
							setExpirationDate(undefined);
						}}
						isSearchable={false}
						styles={selectStyles}
					/>
				)}
			</div>

			{!noTargetsAvailable && (
				<div className="flex flex-col gap-y-1.5">
					<InputTitle>{t("mint.newly_selected_expiration_date")}</InputTitle>
					<DateInputOutlined
						maxDate={selectedTarget ? new Date(selectedTarget.expiration * 1000) : currentExpirationDate}
						value={expirationDate}
						placeholderText={new Date(position.expiration * 1000).toISOString().split("T")[0]}
						className="placeholder:text-input-placeholder"
						onChange={setExpirationDate}
						rightAdornment={
							<MaxButton
								className="h-full py-3.5 px-3"
								onClick={() => setExpirationDate(selectedTarget ? new Date(selectedTarget.expiration * 1000) : undefined)}
								disabled={!selectedTarget}
								label={t("common.max")}
							/>
						}
					/>
					{isExtending && expirationDate && (
						<div className="text-xs font-medium text-text-muted2 px-1">
							{t("mint.extending_by_days", {
								days: Math.ceil((expirationDate.getTime() - currentExpirationDate.getTime()) / (1000 * 60 * 60 * 24)),
							})}
						</div>
					)}
				</div>
			)}

			{selectedTarget && !noTargetsAvailable && (
				<div className="rounded-lg bg-gray-50 p-4 flex flex-col gap-y-2">
					<div className="flex justify-between text-sm">
						<span className="text-text-muted2">{t("mint.outstanding_interest")}</span>
						<span className="font-medium text-text-title">
							{formatAmount(displayedInterest)} {position.deuroSymbol}
						</span>
					</div>
					{priceAdjustmentCost > 0n && (
						<div className="flex justify-between text-sm">
							<span className="text-text-muted2">Price adjustment</span>
							<span className="font-medium text-amber-600">{formatAmount(priceAdjustmentCost)} {position.deuroSymbol}</span>
						</div>
					)}
					<div className="border-t border-gray-300 pt-2 flex justify-between text-sm">
						<span className="font-bold text-text-title">Total cost</span>
						<span className="font-bold text-text-title">
							{formatAmount(totalCost)} {position.deuroSymbol}
						</span>
					</div>
					{rollParams && rollParams.extraCollateral > 0n && (
						<div className="flex justify-between text-sm">
							<span className="text-text-muted2">Extra collateral needed</span>
							<span className="font-medium text-text-title">
								{formatAmount(rollParams.extraCollateral, position.collateralDecimals)} {collateralSymbol}
							</span>
						</div>
					)}
				</div>
			)}

			{hasInsufficientBalance && (
				<div className="p-2 bg-red-50 rounded border border-red-200">
					<div className="text-xs font-medium text-red-600">{t("mint.insufficient_balance", { symbol: position.deuroSymbol })}</div>
					<div className="text-xs text-red-500 mt-1">
						{t("mint.you_have", { amount: formatAmount(deuroBalance), symbol: position.deuroSymbol })}
						<br />
						{t("mint.you_need", { amount: formatAmount(totalCostWithBuffer), symbol: position.deuroSymbol })}
					</div>
				</div>
			)}

			{hasInsufficientCollateral && rollParams && (
				<div className="p-2 bg-red-50 rounded border border-red-200">
					<div className="text-xs font-medium text-red-600">{t("mint.insufficient_balance", { symbol: collateralSymbol })}</div>
					<div className="text-xs text-red-500 mt-1">
						{t("mint.you_have", {
							amount: formatAmount(walletCollateralBalance, position.collateralDecimals),
							symbol: collateralSymbol,
						})}
						<br />
						{t("mint.you_need", {
							amount: formatAmount(rollParams.extraCollateral, position.collateralDecimals),
							symbol: collateralSymbol,
						})}
					</div>
				</div>
			)}

			{isInCooldown && (
				<div className="text-xs sm:text-sm text-text-muted2 px-1">
					{t("monitoring.cooldown")}: {cooldownRemaining}
				</div>
			)}

			{!isOwner ? (
				<Button className="text-lg leading-snug !font-extrabold" disabled>
					Not your position
				</Button>
			) : !isNativeWrappedPosition && !collateralAllowance ? (
				<Button
					className="text-lg leading-snug !font-extrabold"
					onClick={handleApproveCollateral}
					isLoading={isTxOnGoing}
					disabled={isTxOnGoing || noTargetsAvailable || isInCooldown}
				>
					{t("common.approve")} {position.collateralSymbol}
				</Button>
			) : !deuroAllowance ? (
				<Button
					className="text-lg leading-snug !font-extrabold"
					onClick={handleApproveDeuro}
					isLoading={isTxOnGoing}
					disabled={isTxOnGoing || noTargetsAvailable || isInCooldown}
				>
					{t("common.approve")} {position.deuroSymbol}
				</Button>
			) : (
				<Button
					className="text-lg leading-snug !font-extrabold"
					onClick={handleAdjustExpiration}
					isLoading={isTxOnGoing}
					disabled={
						isTxOnGoing ||
						!expirationDate ||
						!isExtending ||
						!selectedTarget ||
						hasInsufficientBalance ||
						hasInsufficientCollateral ||
						isInCooldown
					}
				>
					{t("mint.extend_roll_borrowing")}
				</Button>
			)}

			<DetailsExpandablePanel
				loanDetails={loanDetails}
				collateralPriceDeuro={collateralPrice}
				collateralDecimals={position.collateralDecimals}
				startingLiquidationPrice={BigInt(position.price)}
				extraRows={
						<div className="py-1.5 flex justify-between">
							<span className="text-base leading-tight">{t("common.position")}</span>
							<Link className="underline text-right text-sm font-extrabold leading-none tracking-tight" href={url} target="_blank">
								{shortenAddress(position.position)}
							</Link>
						</div>
					}
				/>
		</div>
	);
};
