import { useEffect, useState } from "react";
import TokenLogo from "@components/TokenLogo";
import { NormalInputOutlined } from "@components/Input/NormalInputOutlined";
import Button from "@components/Button";
import { AddCircleOutlineIcon } from "@components/SvgComponents/add_circle_outline";
import { RemoveCircleOutlineIcon } from "@components/SvgComponents/remove_circle_outline";
import { useTranslation } from "next-i18next";
import { useRouter } from "next/router";
import { RootState, store } from "../../redux/redux.store";
import { PositionQuery } from "@deuro/api";
import { useSelector } from "react-redux";
import { Address, erc20Abi, formatUnits, maxUint256 } from "viem";
import { formatBigInt, formatCurrency, shortenAddress } from "@utils";
import { useWalletERC20Balances } from "../../hooks/useWalletBalances";
import { useChainId, useReadContracts } from "wagmi";
import { writeContract } from "wagmi/actions";
import { PositionV2ABI } from "@deuro/eurocoin";
import { WAGMI_CONFIG } from "../../app.config";
import { toast } from "react-toastify";
import { waitForTransactionReceipt } from "wagmi/actions";
import { renderErrorTxToast } from "@components/TxToast";
import { TxToast } from "@components/TxToast";
import { fetchPositionsList } from "../../redux/slices/positions.slice";
import { DetailsExpandablePanel } from "@components/PageMint/DetailsExpandablePanel";
import { SvgIconButton } from "@components/PageMint/PlusMinusButtons";
import { getLoanDetailsByCollateralAndYouGetAmount } from "../../utils/loanCalculations";
import Link from "next/link";
import { useContractUrl } from "../../hooks/useContractUrl";

export const CollateralManageSection = () => {
	const router = useRouter();
	const [amount, setAmount] = useState("");
	const [isAdd, setIsAdd] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isTxOnGoing, setIsTxOnGoing] = useState(false);
	const { t } = useTranslation();
	const chainId = useChainId();

	const { address: addressQuery } = router.query;
	const positions = useSelector((state: RootState) => state.positions.list.list);
	const position = positions.find((p) => p.position == addressQuery) as PositionQuery;
	const prices = useSelector((state: RootState) => state.prices.coingecko);
	const { balancesByAddress, refetchBalances } = useWalletERC20Balances([
		{
			symbol: position.collateralSymbol,
			address: position.collateral,
			name: position.collateralName,
			allowance: [position.position],
		},
	]);
	const url = useContractUrl(position.position);

	const { data, refetch: refetchReadContracts } = useReadContracts({
		contracts: [
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
				functionName: "price",
			},
			{
				chainId,
				abi: erc20Abi,
				address: position.collateral as Address,
				functionName: "balanceOf",
				args: [position.position],
			},
			{
				chainId,
				abi: PositionV2ABI,
				address: position.position,
				functionName: "getDebt",
			},
		],
	});

	const principal = data?.[0]?.result || 0n;
	const price = data?.[1]?.result || 1n;
	const balanceOf = data?.[2]?.result || 0n; // collateral reserve
	const debt = data?.[3]?.result || 0n;
	const collateralPrice = prices[position.collateral.toLowerCase() as Address]?.price?.eur || 0;
	const collateralValuation = collateralPrice * Number(formatUnits(balanceOf, position.collateralDecimals));
	const walletBalance = balancesByAddress[position.collateral as Address]?.balanceOf || 0n;
	const allowance = balancesByAddress[position.collateral as Address]?.allowance?.[position.position] || 0n;

	const collBalancePosition: number = Math.round((parseInt(position.collateralBalance) / 10 ** position.collateralDecimals) * 100) / 100;
	const collTokenPriceMarket = prices[position.collateral.toLowerCase() as Address]?.price?.eur || 0;
	const collTokenPricePosition: number =
		Math.round((parseInt(position.virtualPrice || position.price) / 10 ** (36 - position.collateralDecimals)) * 100) / 100;

	const marketValueCollateral: number = collBalancePosition * collTokenPriceMarket;
	const positionValueCollateral: number = collBalancePosition * collTokenPricePosition;
	const collateralizationPercentage: number = Math.round((marketValueCollateral / positionValueCollateral) * 10000) / 100;

	const maxToRemoveThreshold =
		balanceOf - (debt * 10n ** BigInt(position.collateralDecimals)) / price - BigInt(position.minimumCollateral);

	const maxToRemove = debt > 0n ? (maxToRemoveThreshold > 0n ? maxToRemoveThreshold : 0n) : balanceOf;

	const handleAddMax = () => {
		setAmount(walletBalance.toString());
	};

	const handleRemoveMax = () => {
		setAmount(maxToRemove.toString());
	};

	const handleApprove = async () => {
		try {
			setIsTxOnGoing(true);

			const approveWriteHash = await writeContract(WAGMI_CONFIG, {
				address: position.collateral as Address,
				abi: erc20Abi,
				functionName: "approve",
				args: [position.position, BigInt(amount)],
			});

			const toastContent = [
				{
					title: t("common.txs.amount"),
					value: formatCurrency(formatUnits(BigInt(amount), position.collateralDecimals)) + " " + position.collateralSymbol,
				},
				{
					title: t("common.txs.spender"),
					value: shortenAddress(position.position),
				},
				{
					title: t("common.txs.transaction"),
					hash: approveWriteHash,
				},
			];

			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: approveWriteHash, confirmations: 1 }), {
				pending: {
					render: <TxToast title={`${t("common.txs.title", { symbol: position.collateralSymbol })}`} rows={toastContent} />,
				},
				success: {
					render: <TxToast title={`${t("common.txs.success", { symbol: position.collateralSymbol })}`} rows={toastContent} />,
				},
			});
			await refetchBalances();
			await refetchReadContracts();
			store.dispatch(fetchPositionsList());
		} catch (error) {
			toast.error(renderErrorTxToast(error)); // TODO: needs to be translated
		} finally {
			setIsTxOnGoing(false);
		}
	};

	const handleAdd = async () => {
		try {
			setIsTxOnGoing(true);

			const contractAmount = BigInt(amount) + balanceOf;

			const addHash = await writeContract(WAGMI_CONFIG, {
				address: position.position,
				abi: PositionV2ABI,
				functionName: "adjust",
				args: [principal, contractAmount, price],
			});

			const toastContent = [
				{
					title: t("common.txs.amount"),
					value: formatCurrency(formatUnits(BigInt(amount), position.collateralDecimals)) + ` ${position.collateralSymbol}`,
				},
				{
					title: t("common.txs.transaction"),
					hash: addHash,
				},
			];

			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: addHash, confirmations: 1 }), {
				pending: {
					render: <TxToast title={t("mint.txs.adding_collateral")} rows={toastContent} />,
				},
				success: {
					render: <TxToast title={t("mint.txs.adding_collateral_success")} rows={toastContent} />,
				},
			});
			setAmount("");
			refetchBalances();
			refetchReadContracts();
		} catch (error) {
			toast.error(renderErrorTxToast(error)); //
		} finally {
			setIsTxOnGoing(false);
		}
	};

	const handleRemove = async () => {
		try {
			setIsTxOnGoing(true);

			const contractAmount = balanceOf - BigInt(amount);
			const addHash = await writeContract(WAGMI_CONFIG, {
				address: position.position,
				abi: PositionV2ABI,
				functionName: "adjust",
				args: [principal, contractAmount, price],
			});

			const toastContent = [
				{
					title: t("common.txs.amount"),
					value: formatCurrency(formatUnits(BigInt(amount), position.collateralDecimals)) + ` ${position.collateralSymbol}`,
				},
				{
					title: t("common.txs.transaction"),
					hash: addHash,
				},
			];

			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: addHash, confirmations: 1 }), {
				pending: {
					render: <TxToast title={t("mint.txs.removing_collateral")} rows={toastContent} />,
				},
				success: {
					render: <TxToast title={t("mint.txs.removing_collateral_success")} rows={toastContent} />,
				},
			});
			setAmount("");
			refetchBalances();
			refetchReadContracts();
		} catch (error) {
			toast.error(renderErrorTxToast(error)); //
		} finally {
			setIsTxOnGoing(false);
		}
	};

	// Error validation only for adding collateral
	useEffect(() => {
		if (!isAdd) return;

		if (!amount) {
			setError(null);
		} else if (BigInt(amount) > walletBalance) {
			setError(t("common.error.insufficient_balance", { symbol: position.collateralSymbol }));
		} else {
			setError(null);
		}
	}, [isAdd, amount, balanceOf]);

	// Error validation only for removing collateral
	useEffect(() => {
		if (isAdd) return;

		if (!amount) {
			setError(null);
		} else if (BigInt(amount) > maxToRemove) {
			setError(t("mint.error.amount_greater_than_max_to_remove"));
		} else if (BigInt(amount) > balanceOf) {
			setError(t("mint.error.amount_greater_than_position_balance"));
		} else {
			setError(null);
		}
	}, [isAdd, amount, balanceOf]);

	const amountToUse = isAdd ? balanceOf + BigInt(amount) : balanceOf - BigInt(amount);
	const loanDetails = getLoanDetailsByCollateralAndYouGetAmount(position, amountToUse, principal);

	return (
		<div className="flex flex-col gap-y-8">
			<div className="flex flex-col gap-y-3">
				<div className="flex flex-row justify-between items-center">
					<div className="pl-3 flex flex-row gap-x-2 items-center">
						<TokenLogo currency={position.collateralSymbol} />
						<div className="flex flex-col">
							<span className="text-base font-extrabold leading-tight">
								<span className="">{formatCurrency(formatUnits(balanceOf, position.collateralDecimals), 0, 5)}</span>{" "}
								{position.collateralSymbol}
							</span>
							<span className="text-xs font-medium text-text-muted2 leading-[1rem]">
								{formatCurrency(collateralValuation)} dEURO
							</span>
						</div>
					</div>
					<div className="flex flex-col sm:flex-row justify-end items-start sm:items-center">
						<SvgIconButton isSelected={isAdd} onClick={() => setIsAdd(true)} SvgComponent={AddCircleOutlineIcon}>
							{t("common.add")}
						</SvgIconButton>
						<SvgIconButton isSelected={!isAdd} onClick={() => setIsAdd(false)} SvgComponent={RemoveCircleOutlineIcon}>
							{t("common.remove")}
						</SvgIconButton>
					</div>
				</div>
				<div className="w-full">
					<NormalInputOutlined
						showTokenLogo={false}
						value={amount}
						onChange={setAmount}
						decimals={position.collateralDecimals}
						unit={position.collateralSymbol}
						isError={Boolean(error)}
						adornamentRow={
							<div className="pl-2 text-xs leading-[1rem] flex flex-row gap-x-2">
								<span className="font-medium text-text-muted3">
									{t(isAdd ? "mint.available_to_add" : "mint.available_to_remove")}:
								</span>
								<button className="text-text-labelButton font-extrabold" onClick={isAdd ? handleAddMax : handleRemoveMax}>
									{formatUnits(isAdd ? walletBalance : maxToRemove, position.collateralDecimals)}{" "}
									{position.collateralSymbol}
								</button>
							</div>
						}
					/>
					{error && <div className="ml-1 text-text-warning text-sm">{error}</div>}
				</div>
				<div className="w-full mt-1.5 px-4 py-2 rounded-xl bg-[#E4F0FC] flex flex-row justify-between items-center text-base font-extrabold text-[#272B38]">
					<span>{t("mint.collateralization")}</span>
					<span>{collateralizationPercentage} %</span>
				</div>
			</div>
			{!isAdd ? (
				<Button
					className="text-lg leading-snug !font-extrabold"
					onClick={handleRemove}
					isLoading={isTxOnGoing}
					disabled={Boolean(error) || !Boolean(amount)}
				>
					{t(isAdd ? "mint.add_collateral" : "mint.remove_collateral")}
				</Button>
			) : allowance >= BigInt(amount) ? (
				<Button
					className="text-lg leading-snug !font-extrabold"
					onClick={handleAdd}
					isLoading={isTxOnGoing}
					disabled={Boolean(error) || !Boolean(amount)}
				>
					{t(isAdd ? "mint.add_collateral" : "mint.remove_collateral")}
				</Button>
			) : (
				<Button className="text-lg leading-snug !font-extrabold" onClick={handleApprove} isLoading={isTxOnGoing}>
					{t("common.approve")}
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
						<Link
							className="underline text-right text-sm font-extrabold leading-none tracking-tight"
							href={url}
							target="_blank"
						>
							{shortenAddress(position.position)}
						</Link>
					</div>
				}
			/>
		</div>
	);
};
