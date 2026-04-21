import { useEffect, useState } from "react";
import { erc20Abi, formatUnits, maxUint256, parseUnits } from "viem";
import { waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { toast } from "react-toastify";
import { formatCurrency, shortenAddress, TOKEN_SYMBOL } from "@utils";
import { TxToast, renderErrorTxToast } from "@components/TxToast";
import { WAGMI_CONFIG } from "../../app.config";
import TokenLogo from "@components/TokenLogo";
import { AddCircleOutlineIcon } from "@components/SvgComponents/add_circle_outline";
import { SvgIconButton } from "@components/PageMint/PlusMinusButtons";
import { RemoveCircleOutlineIcon } from "@components/SvgComponents/remove_circle_outline";
import { NormalInputOutlined } from "@components/Input/NormalInputOutlined";
import Button from "@components/Button";
import { useWalletERC20Balances } from "../../hooks/useWalletBalances";
import { useAccount, useChainId } from "wagmi";
import { useSavingsInterest } from "../../hooks/useSavingsInterest";
import { useTranslation } from "next-i18next";
import { useSelector } from "react-redux";
import { RootState } from "../../redux/redux.store";
import { getAppAddresses, isDeployed, SavingsGatewayV2ABI, SavingsV3ABI, SavingsVaultDEUROABI } from "@contracts";
import { useFrontendCode } from "../../hooks/useFrontendCode";

const DUST_THRESHOLD = parseUnits("0.01", 18);

export default function SavingsInteractionSection() {
	const {
		userSavingsBalance,
		v2SavingsBalance,
		v3SavingsBalance,
		v2Interest,
		v2VaultShares,
		v2VaultAssets,
		v3VaultShares,
		v3VaultAssets,
		isNonCompounding,
		isLoaded,
		refetchInterest,
	} = useSavingsInterest();
	const [amount, setAmount] = useState("");
	const [buttonLabel, setButtonLabel] = useState("");
	const [isDeposit, setIsDeposit] = useState(true);
	const [isTxOnGoing, setIsTxOnGoing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [compoundOverride, setCompoundOverride] = useState<boolean | null>(null);
	const compound = compoundOverride !== null ? compoundOverride : !isNonCompounding;
	const rate = useSelector((state: RootState) => state.savings.savingsInfo?.rate);
	const { t } = useTranslation();
	const account = useAccount();
	const chainId = useChainId();
	const ADDR = getAppAddresses(chainId);
	const { frontendCode } = useFrontendCode();
	const depositTarget = compound ? ADDR.savingsVaultV3 : ADDR.savings;
	const v3Deployed = isDeployed(ADDR.savings);
	const v2VaultDeployed = isDeployed(ADDR.savingsVaultV2);
	const v3VaultDeployed = isDeployed(ADDR.savingsVaultV3);
	const allowanceTargets = [ADDR.savingsVaultV3, ADDR.savings].filter(isDeployed);
	const withdrawableBalance =
		(v2SavingsBalance >= DUST_THRESHOLD ? v2SavingsBalance : 0n) +
		(v2VaultAssets >= DUST_THRESHOLD ? v2VaultAssets : 0n) +
		(v3SavingsBalance >= DUST_THRESHOLD ? v3SavingsBalance : 0n) +
		(v3VaultAssets >= DUST_THRESHOLD ? v3VaultAssets : 0n);

	const { balancesByAddress, refetchBalances } = useWalletERC20Balances([
		{
			address: ADDR.decentralizedEURO,
			symbol: TOKEN_SYMBOL,
			name: TOKEN_SYMBOL,
			allowance: allowanceTargets,
		},
	]);

	const deuroWalletDetails = balancesByAddress?.[ADDR.decentralizedEURO];
	const userBalance = deuroWalletDetails?.balanceOf || 0n;
	const userAllowance = isDeployed(depositTarget) ? deuroWalletDetails?.allowance?.[depositTarget] || 0n : 0n;

	const handleApprove = async () => {
		if (compound && !v3VaultDeployed) return;
		if (!compound && !v3Deployed) return;

		try {
			setIsTxOnGoing(true);

			const approveWriteHash = await writeContract(WAGMI_CONFIG, {
				address: ADDR.decentralizedEURO,
				abi: erc20Abi,
				functionName: "approve",
				args: [depositTarget, maxUint256],
			});

			const toastContent = [
				{
					title: t("common.txs.amount"),
					value: "infinite " + TOKEN_SYMBOL,
				},
				{
					title: t("common.txs.spender"),
					value: shortenAddress(depositTarget),
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

			await refetchBalances();
		} catch (error) {
			toast.error(renderErrorTxToast(error));
		} finally {
			setIsTxOnGoing(false);
		}
	};

	const showToastForWithdraw = async ({ hash, withdrawAmount }: { hash: `0x${string}`; withdrawAmount: bigint }) => {
		const toastContent = [
			{
				title: `${t("savings.txs.withdraw")}`,
				value: `${formatCurrency(formatUnits(withdrawAmount, 18))} ${TOKEN_SYMBOL}`,
			},
			{
				title: `${t("common.txs.transaction")}`,
				hash,
			},
		];

		await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash, confirmations: 1 }), {
			pending: {
				render: <TxToast title={t("savings.txs.withdrawing")} rows={toastContent} />,
			},
			success: {
				render: <TxToast title={t("savings.txs.successfully_withdrawn")} rows={toastContent} />,
			},
		});
	};

	const showToastForDeposit = async ({ hash }: { hash: `0x${string}` }) => {
		const toastContent = [
			{
				title: `${t("savings.txs.saving_amount")}`,
				value: `${formatCurrency(formatUnits(BigInt(amount), 18))} ${TOKEN_SYMBOL}`,
			},
			{
				title: `${t("common.txs.transaction")}`,
				hash,
			},
		];

		await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash, confirmations: 1 }), {
			pending: {
				render: <TxToast title={t("savings.txs.increasing_savings")} rows={toastContent} />,
			},
			success: {
				render: <TxToast title={t("savings.txs.successfully_increased_savings")} rows={toastContent} />,
			},
		});
	};

	const handleSave = async () => {
		if (!account.address) return;
		if (compound && !v3VaultDeployed) return;
		if (!compound && !v3Deployed) return;

		try {
			setIsTxOnGoing(true);

			const saveHash = compound
				? await writeContract(WAGMI_CONFIG, {
						address: ADDR.savingsVaultV3!,
						abi: SavingsVaultDEUROABI,
						functionName: "deposit",
						args: [BigInt(amount), account.address],
				  })
				: await writeContract(WAGMI_CONFIG, {
						address: ADDR.savings!,
						abi: SavingsV3ABI,
						functionName: "save",
						args: [BigInt(amount), false],
				  });

			await showToastForDeposit({ hash: saveHash });
			await refetchInterest();
			await refetchBalances();
			setAmount("");
		} catch (error) {
			toast.error(renderErrorTxToast(error));
		} finally {
			setIsTxOnGoing(false);
		}
	};

	useEffect(() => {
		setCompoundOverride(null);
	}, [isNonCompounding]);

	const handleWithdraw = async () => {
		if (!account.address) return;

		try {
			setIsTxOnGoing(true);
			let remaining = BigInt(amount);

			if (v2SavingsBalance >= DUST_THRESHOLD && remaining > 0n) {
				const withdrawAmount = remaining > v2SavingsBalance ? v2SavingsBalance : remaining;
				const accruedAmount = remaining > v2SavingsBalance ? v2SavingsBalance + v2Interest : remaining + v2Interest;
				const adjustedAmount = remaining >= v2SavingsBalance ? 2n * accruedAmount : accruedAmount;

				const v2Hash = await writeContract(WAGMI_CONFIG, {
					address: ADDR.savingsGateway,
					abi: SavingsGatewayV2ABI,
					functionName: "withdraw",
					args: [account.address, adjustedAmount, frontendCode],
				});

				await showToastForWithdraw({ hash: v2Hash, withdrawAmount });
				remaining = remaining > v2SavingsBalance ? remaining - v2SavingsBalance : 0n;
			}

			if (v2VaultDeployed && v2VaultAssets >= DUST_THRESHOLD && remaining > 0n) {
				if (remaining > v2VaultAssets) {
					const v2Hash = await writeContract(WAGMI_CONFIG, {
						address: ADDR.savingsVaultV2!,
						abi: SavingsVaultDEUROABI,
						functionName: "redeem",
						args: [v2VaultShares, account.address, account.address],
					});
					await showToastForWithdraw({ hash: v2Hash, withdrawAmount: v2VaultAssets });
					remaining = remaining - v2VaultAssets;
				} else {
					const v2Hash = await writeContract(WAGMI_CONFIG, {
						address: ADDR.savingsVaultV2!,
						abi: SavingsVaultDEUROABI,
						functionName: "withdraw",
						args: [remaining, account.address, account.address],
					});
					await showToastForWithdraw({ hash: v2Hash, withdrawAmount: remaining });
					remaining = 0n;
				}
			}

			if (v3Deployed && v3SavingsBalance >= DUST_THRESHOLD && remaining > 0n) {
				const withdrawAmount = remaining > v3SavingsBalance ? v3SavingsBalance : remaining;
				const contractAmount = remaining >= v3SavingsBalance ? 2n * v3SavingsBalance : remaining;

				const v3Hash = await writeContract(WAGMI_CONFIG, {
					address: ADDR.savings!,
					abi: SavingsV3ABI,
					functionName: "withdraw",
					args: [account.address, contractAmount],
				});

				await showToastForWithdraw({ hash: v3Hash, withdrawAmount });
				remaining = remaining > v3SavingsBalance ? remaining - v3SavingsBalance : 0n;
			}

			if (v3VaultDeployed && v3VaultAssets >= DUST_THRESHOLD && remaining > 0n) {
				const isFullDrain = BigInt(amount) >= withdrawableBalance;
				if (isFullDrain) {
					const v3Hash = await writeContract(WAGMI_CONFIG, {
						address: ADDR.savingsVaultV3!,
						abi: SavingsVaultDEUROABI,
						functionName: "redeem",
						args: [v3VaultShares, account.address, account.address],
					});
					await showToastForWithdraw({ hash: v3Hash, withdrawAmount: remaining });
				} else {
					const v3Hash = await writeContract(WAGMI_CONFIG, {
						address: ADDR.savingsVaultV3!,
						abi: SavingsVaultDEUROABI,
						functionName: "withdraw",
						args: [remaining, account.address, account.address],
					});
					await showToastForWithdraw({ hash: v3Hash, withdrawAmount: remaining });
				}
			}

			await refetchInterest();
			await refetchBalances();
			setAmount("");
		} catch (error) {
			toast.error(renderErrorTxToast(error));
		} finally {
			setIsTxOnGoing(false);
		}
	};

	useEffect(() => {
		if (!isDeposit) return;

		if (!amount || !BigInt(amount)) {
			setError(null);
			setButtonLabel(t("savings.enter_amount_to_add_savings"));
			return;
		}

		if (BigInt(amount) > userBalance) {
			setError(t("savings.error.insufficient_balance"));
			setButtonLabel(t("savings.enter_amount_to_add_savings"));
		} else if ((compound && !v3VaultDeployed) || (!compound && !v3Deployed)) {
			setError(t("common.error.wrong_network"));
			setButtonLabel(t("savings.enter_amount_to_add_savings"));
		} else {
			setError(null);
			setButtonLabel(t("savings.start_earning_interest", { rate: rate !== undefined ? `${rate / 10_000}` : "-" }));
		}
	}, [amount, rate, isDeposit, userBalance, compound, v3Deployed, v3VaultDeployed, t]);

	useEffect(() => {
		if (isDeposit) return;

		if (!amount || !BigInt(amount)) {
			setError(null);
			setButtonLabel(t("savings.enter_withdraw_amount"));
			return;
		}

		if (BigInt(amount) > withdrawableBalance) {
			setError(t("savings.error.greater_than_savings"));
			setButtonLabel(t("savings.enter_withdraw_amount"));
			return;
		}

		setError(null);
		setButtonLabel(t("savings.withdraw_to_my_wallet"));
	}, [amount, isDeposit, withdrawableBalance, t]);

	return (
		<>
			<div className="w-full self-stretch justify-center items-center gap-1.5 inline-flex flex-col">
				<div className="text-text-title text-center text-lg sm:text-xl font-black ">{t("savings.earn_yield_on_your_d_euro")}</div>
				<div className="py-1 px-3 rounded-lg bg-[#E4F0FC] text-[#272B38] flex flex-row items-center gap-x-2 text-sm leading-[0.875rem]">
					<span className="font-[400]">{t("savings.savings_rate")} (APR)</span>
					<span className="font-extrabold">{rate !== undefined ? `${rate / 10_000}%` : "-"}</span>
				</div>
			</div>
			<div className="flex flex-col gap-y-3">
				<div className="pb-1 flex flex-row justify-start items-center border-b border-b-borders-dividerLight">
					<span className="text-text-disabled font-medium text-base leading-tight">{t("savings.current_invest")}</span>
				</div>
				<div className="flex flex-row justify-between items-center">
					<div className="pl-3 flex flex-row gap-x-2 items-center">
						<TokenLogo currency={TOKEN_SYMBOL} />
						<div className="flex flex-col">
							<span className="text-base font-extrabold leading-tight">
								<span className="">{formatCurrency(formatUnits(userSavingsBalance, 18))}</span> {TOKEN_SYMBOL}
							</span>
							<span className="text-xs font-medium text-text-muted2 leading-[1rem]"></span>
						</div>
					</div>
					<div className="flex flex-col sm:flex-row justify-end items-start sm:items-center">
						<SvgIconButton isSelected={isDeposit} onClick={() => setIsDeposit(true)} SvgComponent={AddCircleOutlineIcon}>
							{t("savings.deposit")}
						</SvgIconButton>
						<SvgIconButton isSelected={!isDeposit} onClick={() => setIsDeposit(false)} SvgComponent={RemoveCircleOutlineIcon}>
							{t("savings.withdraw")}
						</SvgIconButton>
					</div>
				</div>
				<div className="w-full">
						<NormalInputOutlined
							showTokenLogo={false}
							value={amount.toString()}
							onChange={setAmount}
						decimals={18}
						unit={TOKEN_SYMBOL}
						isError={!!error}
						adornamentRow={
							<div className="pl-2 text-xs leading-[1rem] flex flex-row gap-x-2">
								<span className="font-medium text-text-muted3">
									{t(isDeposit ? "savings.available_to_deposit" : "savings.available_to_withdraw")}:
								</span>
								<button
									className="text-text-labelButton font-extrabold"
									onClick={() => setAmount(isDeposit ? userBalance.toString() : withdrawableBalance.toString())}
								>
									{formatCurrency(formatUnits(isDeposit ? userBalance : withdrawableBalance, 18))} {TOKEN_SYMBOL}
									</button>
								</div>
							}
						/>
						{error && <div className="ml-1 text-text-warning text-sm">{error}</div>}
						{isDeposit && (!account.address || isLoaded) && (
							<label className="mt-1 ml-1 inline-flex items-center gap-x-2 cursor-pointer select-none">
								<input
									type="checkbox"
									checked={compound}
									onChange={(e) => setCompoundOverride(e.target.checked)}
									className="sr-only peer"
								/>
								<div className="w-4 h-4 rounded border border-gray-400 bg-white peer-checked:bg-[#0D4E9C] peer-checked:border-[#0D4E9C] flex items-center justify-center shrink-0">
									{compound && (
										<svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
											<path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
										</svg>
									)}
								</div>
								<span className="text-sm font-medium text-text-muted2">{t("savings.auto_compound_interest")}</span>
							</label>
						)}
					</div>
					<div className="w-full py-1.5">
						{isDeposit && userAllowance < BigInt(amount) ? (
							<Button
								className="text-lg leading-snug !font-extrabold"
								onClick={handleApprove}
								isLoading={isTxOnGoing}
								disabled={!amount || !BigInt(amount) || (compound && !v3VaultDeployed) || (!compound && !v3Deployed)}
							>
								{t("common.approve")}
							</Button>
						) : (
							<Button
								className="text-lg leading-snug !font-extrabold"
								onClick={isDeposit ? handleSave : handleWithdraw}
								isLoading={isTxOnGoing}
								disabled={!!error || !amount || !BigInt(amount) || (isDeposit && compound && !v3VaultDeployed) || (isDeposit && !compound && !v3Deployed)}
							>
								{buttonLabel}
							</Button>
						)}
					</div>
				</div>
		</>
	);
}
