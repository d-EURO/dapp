import React, { useEffect, useState } from "react";
import { usePoolStats } from "@hooks";
import { formatBigInt, formatCurrency, SAVINGS_VAULT_SYMBOL, shortenAddress, TOKEN_SYMBOL } from "@utils";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { erc20Abi, formatUnits, zeroAddress } from "viem";
import Button from "@components/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowDownLong } from "@fortawesome/free-solid-svg-icons";
import { TxToast, renderErrorTxToast } from "@components/TxToast";
import { toast } from "react-toastify";
import GuardToAllowedChainBtn from "@components/Guards/GuardToAllowedChainBtn";
import { WAGMI_CONFIG } from "../../app.config";
import { ADDRESS, JuiceDollarABI, SavingsVaultJUSDABI } from "@juicedollar/jusd";
import { useTranslation } from "next-i18next";
import { TokenInputSelectOutlined } from "@components/Input/TokenInputSelectOutlined";
import { InputTitle } from "@components/Input/InputTitle";
import { MaxButton } from "@components/Input/MaxButton";
import { TokenBalance } from "../../hooks/useWalletBalances";
import { TokenInteractionSide } from "./EquityInteractionCard";
import { RootState } from "../../redux/redux.store";
import { useSelector } from "react-redux";
interface Props {
	openSelector: (tokenInteractionSide: TokenInteractionSide) => void;
	selectedFromToken: TokenBalance | undefined;
	selectedToToken: TokenBalance | undefined;
	refetchBalances: () => void;
	reverseSelection: () => void;
}

export default function InteractionStablecoinAndSavingVault({
	openSelector,
	selectedFromToken,
	selectedToToken,
	refetchBalances,
	reverseSelection,
}: Props) {
	const [amount, setAmount] = useState(0n);
	const [error, setError] = useState("");
	const [isApproving, setApproving] = useState(false);
	const [isInversting, setInversting] = useState(false);
	const [isRedeeming, setRedeeming] = useState(false);
	const { t } = useTranslation();
	const { address } = useAccount();
	const chainId = useChainId();
	const poolStats = usePoolStats();
	const eurPrice = useSelector((state: RootState) => state.prices.eur?.usd);
	const account = address || zeroAddress;
	const direction: boolean = selectedFromToken?.symbol === TOKEN_SYMBOL;

	const { data: stablecoinAllowanceData, refetch: refetchStablecoinAllowance } = useReadContract({
		address: ADDRESS[chainId].juiceDollar,
		abi: JuiceDollarABI,
		functionName: "allowance",
		args: [account, ADDRESS[chainId].savingsVaultJUSD],
	});
	const stablecoinAllowance = stablecoinAllowanceData ? BigInt(String(stablecoinAllowanceData)) : 0n;

	useEffect(() => {
		setAmount(0n);
		setError("");
	}, [selectedFromToken?.symbol]);

	const handleApproveDeposit = async () => {
		try {
			setApproving(true);

			const approveWriteHash = await writeContract(WAGMI_CONFIG, {
				address: ADDRESS[chainId].juiceDollar,
				abi: erc20Abi,
				functionName: "approve",
				args: [ADDRESS[chainId].savingsVaultJUSD, amount],
			});

			const toastContent = [
				{
					title: t("common.txs.amount"),
					value: formatBigInt(amount) + " " + TOKEN_SYMBOL,
				},
				{
					title: t("common.txs.spender"),
					value: shortenAddress(ADDRESS[chainId].savingsVaultJUSD),
				},
				{
					title: t("common.txs.transaction"),
					hash: approveWriteHash,
				},
			];

			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: approveWriteHash, confirmations: 1 }), {
				pending: {
					render: <TxToast title={t("common.txs.title", { symbol: TOKEN_SYMBOL })} rows={toastContent} />,
				},
				success: {
					render: <TxToast title={t("common.txs.success", { symbol: TOKEN_SYMBOL })} rows={toastContent} />,
				},
			});

			await poolStats.refetchPoolStats();
			await refetchStablecoinAllowance();
		} catch (error) {
			toast.error(renderErrorTxToast(error));
		} finally {
			setApproving(false);
		}
	};

	const handleDeposit = async () => {
		try {
			const depositWriteHash = await writeContract(WAGMI_CONFIG, {
				address: ADDRESS[chainId].savingsVaultJUSD,
				abi: SavingsVaultJUSDABI,
				functionName: "deposit",
				args: [amount, address!],
			});

			const toastContent = [
				{
					title: t("common.txs.amount"),
					value: formatBigInt(amount, 18) + " " + TOKEN_SYMBOL,
				},
				{
					title: t("common.txs.shares"),
					value: formatBigInt(result) + " " + SAVINGS_VAULT_SYMBOL,
				},
				{
					title: t("common.txs.transaction"),
					hash: depositWriteHash,
				},
			];

			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: depositWriteHash, confirmations: 1 }), {
				pending: {
					render: <TxToast title={t("equity.txs.investing", { symbol: TOKEN_SYMBOL })} rows={toastContent} />,
				},
				success: {
					render: <TxToast title={t("equity.txs.successfully_invested", { symbol: TOKEN_SYMBOL })} rows={toastContent} />,
				},
			});

			await poolStats.refetchPoolStats();
			await refetchBalances();
		} catch (error) {
			toast.error(renderErrorTxToast(error));
		} finally {
			setAmount(0n);
			setInversting(false);
		}
	};

	const { data: amountInShares } = useReadContract({
		address: ADDRESS[chainId].savingsVaultJUSD,
		abi: SavingsVaultJUSDABI,
		functionName: "convertToShares",
		args: [amount],
	});

	const { data: amountInAssets } = useReadContract({
		address: ADDRESS[chainId].savingsVaultJUSD,
		abi: SavingsVaultJUSDABI,
		functionName: "convertToAssets",
		args: [amount],
	});

	const fromBalance = direction ? poolStats.deuroBalance : poolStats.equityBalance;
	const result = (direction ? amountInShares : amountInAssets) || 0n;
	const fromSymbol = direction ? TOKEN_SYMBOL : SAVINGS_VAULT_SYMBOL;

	const collateralValue = direction ? amount : amountInAssets;
	const collateralEurValue = formatBigInt(collateralValue);
	const collateralUsdValue =
		eurPrice && collateralValue ? formatBigInt((BigInt(Math.floor(eurPrice * 10000)) * collateralValue) / 10000n) : formatBigInt(0n);

	const onChangeAmount = (value: string) => {
		const valueBigInt = BigInt(value);
		setAmount(valueBigInt);
		if (valueBigInt > fromBalance) {
			setError(t("common.error.insufficient_balance", { symbol: fromSymbol }));
		} else {
			setError("");
		}
	};

	const handleRedeem = async () => {
		if (!amountInAssets) return;

		try {
			setRedeeming(true);
			const redeemWriteHash = await writeContract(WAGMI_CONFIG, {
				address: ADDRESS[chainId].savingsVaultJUSD,
				abi: SavingsVaultJUSDABI,
				functionName: "redeem",
				args: [amount, address!, address!],
			});

			const toastContent = [
				{
					title: t("common.txs.amount"),
					value: formatBigInt(amount) + " " + SAVINGS_VAULT_SYMBOL,
				},
				{
					title: t("common.txs.receive"),
					value: formatBigInt(result) + " " + TOKEN_SYMBOL,
				},
				{
					title: t("common.txs.transaction"),
					hash: redeemWriteHash,
				},
			];

			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: redeemWriteHash, confirmations: 1 }), {
				pending: {
					render: <TxToast title={t("equity.txs.redeeming", { symbol: SAVINGS_VAULT_SYMBOL })} rows={toastContent} />,
				},
				success: {
					render: <TxToast title={t("equity.txs.successfully_redeemed", { symbol: SAVINGS_VAULT_SYMBOL })} rows={toastContent} />,
				},
			});

			await poolStats.refetchPoolStats();
			await refetchBalances();
		} catch (error) {
			toast.error(renderErrorTxToast(error)); // TODO: add error translation
		} finally {
			setAmount(0n);
			setRedeeming(false);
		}
	};

	return (
		<div className="flex flex-col">
			<div className="">
				<InputTitle>{t("common.send")}</InputTitle>
				<TokenInputSelectOutlined
					selectedToken={selectedFromToken}
					onSelectTokenClick={() => openSelector(TokenInteractionSide.INPUT)}
					value={amount.toString()}
					onChange={onChangeAmount}
					isError={Boolean(error)}
					errorMessage={error}
					adornamentRow={
						<div className="self-stretch justify-start items-center inline-flex">
							<div className="grow shrink basis-0 h-4 px-2 justify-start items-center gap-2 flex max-w-full overflow-hidden">
								<div className="text-text-muted3 text-xs font-medium leading-none">€{collateralEurValue}</div>
								{eurPrice && (
									<>
										<div className="h-4 w-0.5 border-l border-input-placeholder"></div>
										<div className="text-text-muted3 text-xs font-medium leading-none">${collateralUsdValue}</div>
									</>
								)}
							</div>
							<div className="h-7 justify-end items-center gap-2.5 flex">
								{selectedFromToken && (
									<>
										<div className="text-text-muted3 text-xs font-medium leading-none">
											{t("common.balance_label")}{" "}
											{formatCurrency(
												formatUnits(selectedFromToken?.balanceOf || 0n, selectedFromToken?.decimals || 18)
											)}{" "}
											{selectedFromToken?.symbol}
										</div>
										<MaxButton
											disabled={BigInt(selectedFromToken?.balanceOf || 0n) === BigInt(0)}
											onClick={() => onChangeAmount(selectedFromToken?.balanceOf?.toString() || "0")}
										/>
									</>
								)}
							</div>
						</div>
					}
				/>

				<div className="pt-2 text-center z-0">
					<Button className={`h-10 rounded-full mt-4 !p-2.5`} width="w-10" onClick={reverseSelection}>
						<span className="flex items-center justify-center flex-1">
							<FontAwesomeIcon icon={faArrowDownLong} className="w-5 h-5" />
						</span>
					</Button>
				</div>

				<InputTitle>{t("common.receive")}</InputTitle>
				<TokenInputSelectOutlined
					notEditable
					selectedToken={selectedToToken}
					onSelectTokenClick={() => openSelector(TokenInteractionSide.OUTPUT)}
					value={result.toString()}
					onChange={() => {}}
					adornamentRow={
						<div className="self-stretch justify-start items-center inline-flex">
							<div className="grow shrink basis-0 h-4 px-2 justify-start items-center gap-2 flex max-w-full overflow-hidden">
								<div className="text-text-muted2 text-xs font-medium leading-none">€{collateralEurValue}</div>
								{eurPrice && (
									<>
										<div className="h-4 w-0.5 border-l border-input-placeholder"></div>
										<div className="text-text-muted2 text-xs font-medium leading-none">${collateralUsdValue}</div>
									</>
								)}
							</div>
							<div className="h-7 justify-end items-center gap-2.5 flex">
								{selectedToToken && (
									<>
										<div className="text-text-muted2 text-xs font-medium leading-none">
											{formatUnits(selectedToToken?.balanceOf || 0n, selectedToToken?.decimals || 18)}{" "}
											{selectedToToken?.symbol}
										</div>
										<MaxButton
											disabled={BigInt(selectedToToken?.balanceOf || 0n) === BigInt(0)}
											onClick={() => onChangeAmount(selectedToToken?.balanceOf?.toString() || "0")}
										/>
									</>
								)}
							</div>
						</div>
					}
				/>

				<div className="my-12 max-w-full flex-col">
					<GuardToAllowedChainBtn label={direction ? t("common.deposit") : t("common.withdraw")}>
						{direction ? (
							amount > stablecoinAllowance ? (
								<Button isLoading={isApproving} disabled={amount == 0n || !!error} onClick={() => handleApproveDeposit()}>
									{t("common.approve")}
								</Button>
							) : (
								<Button disabled={amount == 0n || !!error} isLoading={isInversting} onClick={() => handleDeposit()}>
									{t("common.deposit")}
								</Button>
							)
						) : (
							<Button isLoading={isRedeeming} onClick={() => handleRedeem()}>
								{t("common.withdraw")}
							</Button>
						)}
					</GuardToAllowedChainBtn>
				</div>
			</div>

			<div className="border-t border-borders-dividerLight grid grid-cols-1 md:grid-cols-2 gap-2"></div>
		</div>
	);
}
