import Head from "next/head";
import TokenInput from "@components/Input/TokenInput";
import { useCallback, useEffect, useState } from "react";
import { useContractUrl, useSwapStats } from "@hooks";
import { erc20Abi, formatUnits, maxUint256 } from "viem";
import Button from "@components/Button";
import { useChainId } from "wagmi";
import { waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowDown, faArrowUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
import { formatBigInt, shortenAddress, TOKEN_SYMBOL } from "@utils";
import { TxToast, renderErrorToast, renderErrorTxToast } from "@components/TxToast";
import GuardToAllowedChainBtn from "@components/Guards/GuardToAllowedChainBtn";
import { WAGMI_CONFIG } from "../app.config";
import Link from "next/link";
import AppCard from "@components/AppCard";
import { ADDRESS, StablecoinBridgeABI } from "@frankencoin/zchf";
import TokenInputSelect from "@components/Input/TokenInputSelect";

const STABLECOIN_SYMBOLS = ["EURT", "EURC", "VEUR", "EURS"];

export default function Swap() {
	const [fromSymbol, setFromSymbol] = useState(TOKEN_SYMBOL);
	const [fromOptions, setFromOptions] = useState([TOKEN_SYMBOL]);

	const [toSymbol, setToSymbol] = useState(STABLECOIN_SYMBOLS[0]);
	const [toOptions, setToOptions] = useState(STABLECOIN_SYMBOLS);

	const [amount, setAmount] = useState(0n);
	const [error, setError] = useState("");
	const [direction, setDirection] = useState(true);
	const [isApproving, setApproving] = useState(false);
	const [isMinting, setMinting] = useState(false);
	const [isBurning, setBurning] = useState(false);

	const chainId = useChainId();
	const swapStats = useSwapStats(); // returns onchain data, change it to return balances of stablecoins as well
	const xchfUrl = useContractUrl(ADDRESS[chainId].xchf);

	const handleApprove = async () => {
		try {
			setApproving(true);
			const approveWriteHash = await writeContract(WAGMI_CONFIG, {
				address: ADDRESS[chainId].xchf,
				abi: erc20Abi,
				functionName: "approve",
				args: [ADDRESS[chainId].bridge, maxUint256],
			});

			const toastContent = [
				{
					title: "Amount:",
					value: "infinite",
				},
				{
					title: "Spender: ",
					value: shortenAddress(ADDRESS[chainId].bridge),
				},
				{
					title: "Transaction:",
					hash: approveWriteHash,
				},
			];

			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: approveWriteHash, confirmations: 1 }), {
				pending: {
					render: <TxToast title="Approving XCHF" rows={toastContent} />,
				},
				success: {
					render: <TxToast title="Successfully Approved XCHF" rows={toastContent} />,
				},
			});
		} catch (error) {
			toast.error(renderErrorTxToast(error));
		} finally {
			setApproving(false);
		}
	};
	const handleMint = async () => {
		try {
			setMinting(true);
			const mintWriteHash = await writeContract(WAGMI_CONFIG, {
				address: ADDRESS[chainId].bridge,
				abi: StablecoinBridgeABI,
				functionName: "mint",
				args: [amount],
			});

			const toastContent = [
				{
					title: `${fromSymbol} Amount: `,
					value: formatBigInt(amount) + " " + fromSymbol,
				},
				{
					title: `${toSymbol} Amount: `,
					value: formatBigInt(amount) + " " + toSymbol,
				},
				{
					title: "Transaction:",
					hash: mintWriteHash,
				},
			];

			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: mintWriteHash, confirmations: 1 }), {
				pending: {
					render: <TxToast title={`Swapping ${fromSymbol} to ${toSymbol}`} rows={toastContent} />,
				},
				success: {
					render: <TxToast title={`Successfully Swapped ${fromSymbol} to ${toSymbol}`} rows={toastContent} />,
				},
			});
		} catch (error) {
			toast.error(renderErrorTxToast(error));
		} finally {
			setMinting(false);
		}
	};
	const handleBurn = async () => {
		try {
			setBurning(true);

			const burnWriteHash = await writeContract(WAGMI_CONFIG, {
				address: ADDRESS[chainId].bridge,
				abi: StablecoinBridgeABI,
				functionName: "burn",
				args: [amount],
			});

			const toastContent = [
				{
					title: `${fromSymbol} Amount: `,
					value: formatBigInt(amount) + " " + fromSymbol,
				},
				{
					title: `${toSymbol} Amount: `,
					value: formatBigInt(amount) + " " + toSymbol,
				},
				{
					title: "Transaction:",
					hash: burnWriteHash,
				},
			];

			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: burnWriteHash, confirmations: 1 }), {
				pending: {
					render: <TxToast title={`Swapping ${fromSymbol} to ${toSymbol}`} rows={toastContent} />,
				},
				success: {
					render: <TxToast title={`Successfully Swapped ${fromSymbol} to ${toSymbol}`} rows={toastContent} />,
				},
			});
		} catch (error) {
			toast.error(renderErrorTxToast(error));
		} finally {
			setBurning(false);
		}
	};

	const getBalanceBySymbol = useCallback(
		(symbol: string) => {
			switch (symbol) {
				case TOKEN_SYMBOL:
					return swapStats.xchfUserBal;
				default:
					return swapStats.zchfUserBal;
			}
		},
		[swapStats]
	);

	const getSwapLimitBySymbol = useCallback(
		(symbol: string) => {
			switch (symbol) {
				case TOKEN_SYMBOL:
					return swapStats.bridgeLimit - swapStats.xchfBridgeBal;
				default:
					return swapStats.xchfBridgeBal;
			}
		},
		[swapStats]
	);


	const onChangeDirection = () => {
		// swap symbols
		const prevFromSymbol = fromSymbol;
		const prevToSymbol = toSymbol;
		setFromSymbol(prevToSymbol);
		setToSymbol(prevFromSymbol);

		// swap options
		const prevFromOptions = fromOptions;
		const prevToOptions = toOptions;
		setFromOptions(prevToOptions);
		setToOptions(prevFromOptions);
	};

	const onChangeAmount = (value: string) => {
		const valueBigInt = BigInt(value);
		setAmount(valueBigInt);
	};

	// For triggering errors when the amount or the symbol is changed
	useEffect(() => {
		if (amount > getBalanceBySymbol(fromSymbol)) {
			setError(`Not enough ${fromSymbol} in your wallet.`);
		} else if (amount > getSwapLimitBySymbol(fromSymbol)) {
			setError(`Not enough ${toSymbol} available to swap.`);
		} else {
			setError("");
		}
	}, [amount, fromSymbol, toSymbol]);

	return (
		<>
			<Head>
				<title>dEURO - Swap</title>
			</Head>

			<div className="md:mt-8">
				<AppCard>
					<div className="mt-4 text-lg font-bold underline text-center">Swap {TOKEN_SYMBOL} for other stablecoins</div>

					<div className="mt-8">
						<TokenInputSelect
							max={getBalanceBySymbol(fromSymbol)}
							symbol={fromSymbol}
							symbolOptions={fromOptions}
							symbolOnChange={(o) => setFromSymbol(o.value)}
							limit={getSwapLimitBySymbol(fromSymbol)}
							limitLabel="Swap limit"
							placeholder={"Swap Amount"}
							onChange={onChangeAmount}
							value={amount.toString()}
							error={error}
						/>
					</div>

					<div className="py-4 text-center z-0">
						<Button className={`h-10 rounded-full`} width="w-10" onClick={onChangeDirection}>
							<FontAwesomeIcon icon={faArrowDown} className="w-6 h-6" />
						</Button>
					</div>

					<TokenInputSelect
						symbol={toSymbol}
						symbolOptions={toOptions}
						symbolOnChange={(o) => setToSymbol(o.value)}
						max={getBalanceBySymbol(toSymbol)}
						output={formatUnits(amount, 18)}
						note={`1 ${fromSymbol} = 1 ${toSymbol}`}
						label="Receive"
					/>

					<div className="mx-auto mt-8 w-72 max-w-full flex-col">
						<GuardToAllowedChainBtn>
							{direction ? (
								amount > swapStats.xchfUserAllowance ? (
									<Button isLoading={isApproving} onClick={() => handleApprove()}>
										Approve
									</Button>
								) : (
									<Button disabled={amount == 0n || !!error} isLoading={isMinting} onClick={() => handleMint()}>
										Swap
									</Button>
								)
							) : (
								<Button isLoading={isBurning} disabled={amount == 0n || !!error} onClick={() => handleBurn()}>
									Swap
								</Button>
							)}
						</GuardToAllowedChainBtn>
					</div>
				</AppCard>
			</div>
		</>
	);
}
