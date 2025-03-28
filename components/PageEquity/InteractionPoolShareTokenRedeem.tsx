import React, { useEffect, useState } from "react";
import AppBox from "@components/AppBox";
import DisplayLabel from "@components/DisplayLabel";
import DisplayAmount from "@components/DisplayAmount";
import { usePoolStats } from "@hooks";
import { formatBigInt, formatDuration, POOL_SHARE_TOKEN_SYMBOL, shortenAddress, TOKEN_SYMBOL } from "@utils";
import { useAccount, useBlockNumber, useChainId } from "wagmi";
import { readContract, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { erc20Abi, formatUnits, zeroAddress } from "viem";
import Button from "@components/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowDown, faArrowDown19, faArrowDownLong } from "@fortawesome/free-solid-svg-icons";
import { TxToast, renderErrorToast, renderErrorTxToast } from "@components/TxToast";
import { toast } from "react-toastify";
import GuardToAllowedChainBtn from "@components/Guards/GuardToAllowedChainBtn";
import { WAGMI_CONFIG } from "../../app.config";
import TokenInputSelect from "@components/Input/TokenInputSelect";
import { ADDRESS, EquityABI, DEPSWrapperABI, FrontendGatewayABI } from "@deuro/eurocoin";
import { useTranslation } from "next-i18next";
import { useFrontendCode } from "../../hooks/useFrontendCode";

interface Props {
	tokenFromTo: { from: string; to: string };
	setTokenFromTo: (set: { from: string; to: string }) => void;
	selectorMapping: { [key: string]: string[] };
}

export default function InteractionPoolShareTokenRedeem({ tokenFromTo, setTokenFromTo, selectorMapping }: Props) {
	const [amount, setAmount] = useState(0n);
	const [error, setError] = useState("");
	const [isApproving, setApproving] = useState(false);
	const [isRedeeming, setRedeeming] = useState(false);
	const [psTokenAllowance, setPsTokenAllowance] = useState<bigint>(0n);
	const [psTokenBalance, setPsTokenBalance] = useState<bigint>(0n);
	const [psTokenHolding, setPsTokenHolding] = useState<bigint>(0n);
	const [calculateProceeds, setCalculateProceeds] = useState<bigint>(0n);
	const { frontendCode } = useFrontendCode();

	const { t } = useTranslation();
	const { data } = useBlockNumber({ watch: true });
	const { address } = useAccount();
	const poolStats = usePoolStats();
	const chainId = useChainId();
	const account = address || zeroAddress;
	const direction: boolean = true;

	useEffect(() => {
		setAmount(0n);
		setError("");
	}, [tokenFromTo]);

	useEffect(() => {
		const fetchAsync = async function () {
			if (account != zeroAddress) {
				const _psTokenAllowance = await readContract(WAGMI_CONFIG, {
					address: ADDRESS[chainId].DEPSwrapper,
					abi: erc20Abi,
					functionName: "allowance",
					args: [account, ADDRESS[chainId].frontendGateway],
				});
				setPsTokenAllowance(_psTokenAllowance);

				const _psTokenBalance = await readContract(WAGMI_CONFIG, {
					address: ADDRESS[chainId].DEPSwrapper,
					abi: erc20Abi,
					functionName: "balanceOf",
					args: [account],
				});
				setPsTokenBalance(_psTokenBalance);
			}

			const _psTokenHolding = await readContract(WAGMI_CONFIG, {
				address: ADDRESS[chainId].equity,
				abi: EquityABI,
				functionName: "holdingDuration",
				args: [ADDRESS[chainId].DEPSwrapper],
			});
			setPsTokenHolding(_psTokenHolding);
		};

		fetchAsync();
	}, [data, account, chainId]);

	useEffect(() => {
		const fetchAsync = async function () {
			const _calculateProceeds = await readContract(WAGMI_CONFIG, {
				address: ADDRESS[chainId].equity,
				abi: EquityABI,
				functionName: "calculateProceeds",
				args: [amount],
			});
			setCalculateProceeds(_calculateProceeds);
		};

		fetchAsync();
	}, [chainId, amount]);

	const handleApprove = async () => {
		try {
			setApproving(true);

			const approveWriteHash = await writeContract(WAGMI_CONFIG, {
				address: ADDRESS[chainId].DEPSwrapper,
				abi: erc20Abi,
				functionName: "approve",
				args: [ADDRESS[chainId].frontendGateway, amount],
			});

			const toastContent = [
				{
					title: t("common.txs.amount"),
					value: formatBigInt(amount) + " " + POOL_SHARE_TOKEN_SYMBOL,
				},
				{
					title: t("common.txs.spender"),
					value: shortenAddress(ADDRESS[chainId].DEPSwrapper),
				},
				{
					title: t("common.txs.transaction"),
					hash: approveWriteHash,
				},
			];

			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: approveWriteHash, confirmations: 1 }), {
				pending: {
					render: <TxToast title={t("common.txs.title", { symbol: POOL_SHARE_TOKEN_SYMBOL })} rows={toastContent} />,
				},
				success: {
					render: <TxToast title={t("common.txs.success", { symbol: POOL_SHARE_TOKEN_SYMBOL })} rows={toastContent} />,
				},
			});
			await poolStats.refetchPoolStats();
			setPsTokenAllowance(amount);
		} catch (error) {
			toast.error(renderErrorTxToast(error)); // TODO: add error translation
		} finally {
			setApproving(false);
		}
	};

	const handleRedeem = async () => {
		try {
			setRedeeming(true);

			const writeHash = await writeContract(WAGMI_CONFIG, {
				address: ADDRESS[chainId].frontendGateway,
				abi: FrontendGatewayABI,
				functionName: "unwrapAndSell",
				args: [amount, frontendCode],
			});

			const toastContent = [
				{
					title: t("common.txs.amount"),
					value: formatBigInt(amount) + " " + POOL_SHARE_TOKEN_SYMBOL,
				},
				{
					title: t("common.txs.receive"),
					value: formatBigInt(calculateProceeds) + " " + TOKEN_SYMBOL,
				},
				{
					title: t("common.txs.transaction"),
					hash: writeHash,
				},
			];

			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: writeHash, confirmations: 1 }), {
				pending: {
					render: <TxToast title={t("equity.txs.redeem", { symbol: POOL_SHARE_TOKEN_SYMBOL })} rows={toastContent} />,
				},
				success: {
					render: <TxToast title={t("equity.txs.success_redeem", { symbol: POOL_SHARE_TOKEN_SYMBOL })} rows={toastContent} />,
				},
			});
			await poolStats.refetchPoolStats();
		} catch (error) {
			toast.error(renderErrorTxToast(error)); // TODO: add error translation
		} finally {
			setAmount(0n);
			setRedeeming(false);
		}
	};

	const fromSymbol = POOL_SHARE_TOKEN_SYMBOL;
	const toSymbol = TOKEN_SYMBOL;
	const unlocked = psTokenHolding > 86_400 * 90 && psTokenHolding < 86_400 * 365 * 30;
	const redeemLeft = unlocked ? 0n : 86_400n * 90n - psTokenHolding;

	const onChangeAmount = (value: string) => {
		const valueBigInt = BigInt(value);
		setAmount(valueBigInt);
		if (valueBigInt > psTokenBalance) {
			setError(t("common.error.insufficient_balance", { symbol: fromSymbol }));
		} else {
			setError("");
		}
	};


	return (
		<>
			<div className="mb-4">
				<TokenInputSelect
					max={psTokenBalance}
					symbol={fromSymbol}
					symbolOptions={Object.keys(selectorMapping) || []}
					symbolOnChange={(o) => setTokenFromTo({ from: o.label, to: selectorMapping[o.label][0] })}
					onChange={onChangeAmount}
					value={amount.toString()}
					error={error}
					placeholder={t("common.symbol_amount", { symbol: fromSymbol })}
				/>

				<div className="py-2 text-center z-0">
					<Button className={`h-10 rounded-full mt-4 !p-2.5`} width="w-10" onClick={() => setTokenFromTo({ from: toSymbol, to: fromSymbol })}>
						<span className="flex items-center justify-center flex-1">
							<FontAwesomeIcon icon={faArrowDownLong} className="w-5 h-5" />
						</span>
					</Button>
				</div>

				<TokenInputSelect
					symbol={toSymbol}
					symbolOptions={selectorMapping[fromSymbol] || []}
					symbolOnChange={(o) => setTokenFromTo({ from: tokenFromTo.from, to: o.label })}
					hideMaxLabel
					output={Math.round(parseFloat(formatUnits(calculateProceeds, 18)) * 10000) / 10000}
					label={t("common.receive")}
				/>

				<div className="mx-auto mt-8 w-72 max-w-full flex-col">
					<GuardToAllowedChainBtn label={t("equity.unwrap_and_redeem")}>
						{amount > psTokenAllowance ? (
							<Button isLoading={isApproving} disabled={amount == 0n || !!error || !unlocked} onClick={() => handleApprove()}>
								{t("common.approve")}
							</Button>
						) : (
							<Button isLoading={isRedeeming} disabled={amount == 0n || !!error || !unlocked} onClick={() => handleRedeem()}>
								{t("equity.unwrap_and_redeem")}
							</Button>
						)}
					</GuardToAllowedChainBtn>
				</div>
			</div>

			<div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-2">
				<AppBox>
					<DisplayLabel label={t("equity.your_balance")} />
					<DisplayAmount className="mt-2" bold amount={psTokenBalance} currency={POOL_SHARE_TOKEN_SYMBOL} address={ADDRESS[chainId].DEPSwrapper} />
				</AppBox>
				<AppBox>
					<DisplayLabel label={t("equity.value_at_current_price")} />
					<DisplayAmount
						className="mt-2"
						amount={(poolStats.equityPrice * psTokenBalance) / BigInt(1e18)}
						currency={TOKEN_SYMBOL}
						address={ADDRESS[chainId].decentralizedEURO}
						bold
					/>
				</AppBox>
				<AppBox>
					<DisplayLabel label={t("equity.holding_duration_contract", { symbol: POOL_SHARE_TOKEN_SYMBOL })} />
					<div className={!unlocked ? "text-text-warning font-bold" : ""}>
						{psTokenHolding > 0 && psTokenHolding < 86_400 * 365 * 10 ? formatDuration(psTokenHolding) : "--"}
					</div>
				</AppBox>
				<AppBox className="flex-1">
					<DisplayLabel label={t("equity.can_redeem_after_symbol")} />
					<div className={!unlocked ? "text-text-warning font-bold mt-2" : ""}>{formatDuration(redeemLeft)}</div>
				</AppBox>
			</div>
		</>
	);
}
