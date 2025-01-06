import { useCallback, useEffect, useState } from "react";
import { erc20Abi, formatUnits, maxUint256 } from "viem";
import Button from "@components/Button";
import { waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { toast } from "react-toastify";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowDown } from "@fortawesome/free-solid-svg-icons";
import { formatBigInt, shortenAddress, TOKEN_SYMBOL } from "@utils";
import { TxToast, renderErrorTxToast } from "@components/TxToast";
import GuardToAllowedChainBtn from "@components/Guards/GuardToAllowedChainBtn";
import AppCard from "@components/AppCard";
import { StablecoinBridgeABI } from "@deuro/eurocoin";
import TokenInputSelect from "@components/Input/TokenInputSelect";
import { HorizontalStepper } from "@components/HorizontalStepper";
import { WAGMI_CONFIG } from "../../app.config";

const rebaseDecimals = (amount: bigint, fromDecimals: bigint, toDecimals: bigint) => {
	return (amount * 10n ** toDecimals) / 10n ** fromDecimals;
};

const getAmountWithLeastPrecision = (amount: bigint, fromDecimals: bigint, toDecimals: bigint) => {
	const potentialAmount = rebaseDecimals(rebaseDecimals(amount, fromDecimals, toDecimals), toDecimals, fromDecimals);
	return potentialAmount > amount ? amount : potentialAmount;
};

type Step = {
	id: number;
	name: string;
	transaction: () => Promise<void>;
}

interface MultiStepSwapProps {
	fromSymbol: string;
	fromOptions: string[];
	toSymbol: string;
	toOptions: string[];
	swapStats: any;
	setFromSymbol: (symbol: string) => void;
	setToSymbol: (symbol: string) => void;
	onChangeDirection: () => void;
}

export default function Swap({
	fromSymbol,
	fromOptions,
	toSymbol,
	toOptions,
	swapStats,
	setFromSymbol,
	setToSymbol,
	onChangeDirection,
}: MultiStepSwapProps) {
	const [amount, setAmount] = useState(0n);
	const [steps, setSteps] = useState<Step[]>([]);
	const [currentStep, setCurrentStep] = useState(-1);
	const [isTxOnGoing, setTxOnGoing] = useState(false);
	const [isSwapOnGoing, setIsSwapOnGoing] = useState(false);
	const [isDone, setIsDone] = useState(false);
	const [error, setError] = useState("");

	const getStablecoinMetaBySymbol = useCallback(
		(symbol: string) => {
			switch (symbol) {
				case "EURT":
					return swapStats.eurt;
				case "EURC":
					return swapStats.eurc;
				case "VEUR":
					return swapStats.veur;
				case "EURS":
					return swapStats.eurs;
			}
		},
		[swapStats]
	);

	const onChangeAmount = useCallback(
		(value: string) => {
			const valueBigInt = BigInt(value);
			const fromTokenDecimals = getStablecoinMetaBySymbol(fromSymbol).decimals;
			const toTokenDecimals = getStablecoinMetaBySymbol(toSymbol).decimals;
			const newAmount = getAmountWithLeastPrecision(valueBigInt, fromTokenDecimals, toTokenDecimals);
			setAmount(newAmount);
		},
		[fromSymbol, toSymbol, getStablecoinMetaBySymbol]
	);

	const handleChangeDirection = () => {
		if (amount > 0n) {
			const fromTokenData = getStablecoinMetaBySymbol(fromSymbol);
			const toTokenData = getStablecoinMetaBySymbol(toSymbol);
			const newAmount = rebaseDecimals(amount, fromTokenData.decimals, toTokenData.decimals);
			setAmount(newAmount);
		}
		onChangeDirection();
	};

	const onSetFromSymbol = (symbol: string) => {
		const isStablecoin = symbol !== TOKEN_SYMBOL;
		if (amount > 0n && isStablecoin) {
			const newToken = getStablecoinMetaBySymbol(symbol);
			const oldToken = getStablecoinMetaBySymbol(fromSymbol);
			const newAmount = rebaseDecimals(amount, oldToken.decimals, newToken.decimals);
			setAmount(newAmount);
		}

		setFromSymbol(symbol);
	};

	const onSetToSymbol = (symbol: string) => {
		const isStablecoin = symbol !== TOKEN_SYMBOL;
		if (amount > 0n && isStablecoin) {
			const fromTokenDecimals = getStablecoinMetaBySymbol(fromSymbol).decimals;
			const newTokenDecimals = getStablecoinMetaBySymbol(symbol).decimals;
			const newAmount = getAmountWithLeastPrecision(amount, fromTokenDecimals, newTokenDecimals);
			setAmount(newAmount);
		}
		setToSymbol(symbol);
	};

	// Only for triggering errors when the amount or the symbol is changed
	useEffect(() => {
		if(isSwapOnGoing) return;

		const fromTokenData = getStablecoinMetaBySymbol(fromSymbol);
		const toTokenData = getStablecoinMetaBySymbol(toSymbol);
		const mintingContractLimitRemaning = fromTokenData.remaining;
		const burningContractBalance = rebaseDecimals(toTokenData.bridgeBal, toTokenData.decimals, fromTokenData.decimals);

		if (amount > fromTokenData.userBal) {
			setError(`Not enough ${fromSymbol} in your wallet.`);
		} else if (amount > mintingContractLimitRemaning) {
			setError(`Amount exceeds the swap limit.`);
		} else if (amount > burningContractBalance) {
			setError(`Not enough ${toSymbol} available to swap.`);
		} else {
			setError("");
		}
	}, [amount, fromSymbol, toSymbol, getStablecoinMetaBySymbol]);

	const handleApproveFromToken = async () => {
		try {
			setTxOnGoing(true);
			const fromTokenData = getStablecoinMetaBySymbol(fromSymbol);
			const fromContractAddress = fromTokenData.contractAddress;
			const bridgeAddress = fromTokenData.contractBridgeAddress as `0x${string}`;

			const approveWriteHash = await writeContract(WAGMI_CONFIG, {
				address: fromContractAddress as `0x${string}`,
				abi: erc20Abi,
				functionName: "approve",
				args: [bridgeAddress, maxUint256],
			});

			const toastContent = [
				{
					title: "Amount:",
					value: "infinite",
				},
				{
					title: "Spender: ",
					value: shortenAddress(bridgeAddress),
				},
				{
					title: "Transaction:",
					hash: approveWriteHash,
				},
			];

			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: approveWriteHash, confirmations: 1 }), {
				pending: {
					render: <TxToast title={`Approving ${fromSymbol}`} rows={toastContent} />,
				},
				success: {
					render: <TxToast title={`Successfully Approved ${fromSymbol}`} rows={toastContent} />,
				},
			});
		} catch (error) {
			toast.error(renderErrorTxToast(error));
			throw error;
		} finally {
			setTxOnGoing(false);
		}
	};

	const handleApproveDEURO = async () => {
		try {
			setTxOnGoing(true);

			const deuroTokenData = swapStats.dEuro;
			const deuroContractAddress = deuroTokenData.contractAddress;
			const bridgeAddress = swapStats.dEuro.bridgeAllowance[fromSymbol] as `0x${string}`;

			const approveWriteHash = await writeContract(WAGMI_CONFIG, {
				address: deuroContractAddress as `0x${string}`,
				abi: erc20Abi,
				functionName: "approve",
				args: [bridgeAddress, maxUint256],
			});

			const toastContent = [
				{
					title: "Amount:",
					value: "infinite",
				},
				{
					title: "Spender: ",
					value: shortenAddress(bridgeAddress),
				},
				{
					title: "Transaction:",
					hash: approveWriteHash,
				},
			];

			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: approveWriteHash, confirmations: 1 }), {
				pending: {
					render: <TxToast title={`Approving ${TOKEN_SYMBOL}`} rows={toastContent} />,
				},
				success: {
					render: <TxToast title={`Successfully Approved ${TOKEN_SYMBOL}`} rows={toastContent} />,
				},
			});
		} catch (error) {
			toast.error(renderErrorTxToast(error));
			throw error;
		} finally {
			setTxOnGoing(false);
		}
	};

	const handleMint = async () => {
		try {
			setTxOnGoing(true);

			const fromTokenMeta = getStablecoinMetaBySymbol(fromSymbol);
			const bridgeAddress = fromTokenMeta.contractBridgeAddress as `0x${string}`;
			const fromDecimals = fromTokenMeta.decimals;

			const mintWriteHash = await writeContract(WAGMI_CONFIG, {
				address: bridgeAddress,
				abi: StablecoinBridgeABI,
				functionName: "mint",
				args: [amount],
			});

			const toastContent = [
				{
					title: `${fromSymbol} Amount: `,
					value: formatBigInt(amount, Number(fromDecimals)) + " " + fromSymbol,
				},
				{
					title: `${TOKEN_SYMBOL} Amount: `,
					value: formatBigInt(amount, Number(fromDecimals)) + " " + TOKEN_SYMBOL,
				},
				{
					title: "Transaction:",
					hash: mintWriteHash,
				},
			];

			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: mintWriteHash, confirmations: 1 }), {
				pending: {
					render: <TxToast title={`Swapping ${fromSymbol} to ${TOKEN_SYMBOL}`} rows={toastContent} />,
				},
				success: {
					render: <TxToast title={`Successfully Swapped ${fromSymbol} to ${TOKEN_SYMBOL}`} rows={toastContent} />,
				},
			});
		} catch (error) {
			toast.error(renderErrorTxToast(error));
			throw error;
		} finally {
			setTxOnGoing(false);
		}
	};

	const handleBurn = async () => {
		try {
			setTxOnGoing(true);

			const bridgeAddress = getStablecoinMetaBySymbol(toSymbol).contractBridgeAddress as `0x${string}`;
			const toDecimals = getStablecoinMetaBySymbol(toSymbol).decimals;
			const deuroDecimals = swapStats.dEuro.decimals;
			const fromDecimals = getStablecoinMetaBySymbol(fromSymbol).decimals;
				
			const burnWriteHash = await writeContract(WAGMI_CONFIG, {
				address: bridgeAddress,
				abi: StablecoinBridgeABI,
				functionName: "burn",
				args: [rebaseDecimals(amount, fromDecimals, deuroDecimals)],
			});

			const toastContent = [
				{
					title: `${TOKEN_SYMBOL} Amount: `,
					value: formatBigInt(amount, Number(toDecimals)) + " " + TOKEN_SYMBOL,
				},
				{
					title: `${toSymbol} Amount: `,
					value: formatBigInt(amount, Number(toDecimals)) + " " + toSymbol,
				},
				{
					title: "Transaction:",
					hash: burnWriteHash,
				},
			];

			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: burnWriteHash, confirmations: 1 }), {
				pending: {
					render: <TxToast title={`Swapping ${TOKEN_SYMBOL} to ${toSymbol}`} rows={toastContent} />,
				},
				success: {
					render: <TxToast title={`Successfully Swapped ${TOKEN_SYMBOL} to ${toSymbol}`} rows={toastContent} />,
				},
			});
		} catch (error) {
			toast.error(renderErrorTxToast(error));
			throw error;
		} finally {
			setTxOnGoing(false);
		}
	};

	const handleDone = async () => {
		setIsDone(true);
		onChangeAmount("0");
		await new Promise((resolve) => setTimeout(resolve, 5000));
		updateSteps();
		setIsDone(false);
	};

	const updateSteps = useCallback(() => {
		setIsSwapOnGoing(false);

		const computedSteps = [];

		const fromTokenData = getStablecoinMetaBySymbol(fromSymbol);
		if (fromTokenData.userAllowance === 0n || fromTokenData.userAllowance < amount)
			computedSteps.push({ id: computedSteps.length, name: `Approve ${fromSymbol}`, transaction: handleApproveFromToken });

		computedSteps.push({ id: computedSteps.length, name: "Swap dEURO", transaction: handleMint });

		const dEuroAllowance = swapStats.dEuro.bridgeAllowance[fromSymbol];
		if (dEuroAllowance === 0n || dEuroAllowance < amount) computedSteps.push({ id: computedSteps.length, name: `Approve ${TOKEN_SYMBOL}`, transaction: handleApproveDEURO });

		computedSteps.push({ id: computedSteps.length, name: `Swap ${toSymbol}`, transaction: handleBurn });
		
		setSteps(computedSteps);
		setCurrentStep(-1); // signaling that process is not started yet
	}, [amount, fromSymbol, toSymbol, getStablecoinMetaBySymbol, handleApproveFromToken, handleApproveDEURO, handleMint, handleBurn]);

	useEffect(() => {
		updateSteps();
	}, [amount, fromSymbol, toSymbol]);

	const handleStartSwap = async () => {
		setIsSwapOnGoing(true);
		try {
			// Execute the transactions, don't execute transaction with index less than currentStep
			for (let i = currentStep; i < steps.length; i++) {
				if (!steps[i]) {
					setCurrentStep(s => s + 1);
					continue;
				}

				await steps[i].transaction();
				swapStats.refetch();

				setCurrentStep(s => s + 1);
			}

			// Just for giving completion feedback
			await handleDone();
			setIsSwapOnGoing(false);
		} catch (error) {
		} finally {
			setTxOnGoing(false);
		}
	};

	const fromTokenMeta = getStablecoinMetaBySymbol(fromSymbol);
	const toTokenMeta = getStablecoinMetaBySymbol(toSymbol);
	const outputAmount = formatUnits(rebaseDecimals(amount, fromTokenMeta.decimals, toTokenMeta.decimals), Number(toTokenMeta.decimals));
	const mintingContractLimitRemaning = fromTokenMeta.remaining;
	const burningContractBalance = toTokenMeta.bridgeBal;
	const limit = mintingContractLimitRemaning < burningContractBalance ? mintingContractLimitRemaning : burningContractBalance;

	return (
		<AppCard>
			<div className="mt-4 text-lg font-bold underline text-center">Swap {TOKEN_SYMBOL} for other stablecoins</div>

			<div className="mt-8">
				<TokenInputSelect
					digit={fromTokenMeta.decimals}
					max={fromTokenMeta.userBal}
					symbol={fromTokenMeta.symbol}
					symbolOptions={fromOptions}
					symbolOnChange={(o) => onSetFromSymbol(o.value)}
					limit={limit}
					limitLabel="Swap limit"
					limitDigits={toTokenMeta.decimals}
					placeholder={"Swap Amount"}
					onChange={onChangeAmount}
					value={amount.toString()}
					error={error}
				/>
			</div>

			<div className="py-4 text-center z-0">
				<Button className={`h-10 rounded-full`} width="w-10" onClick={handleChangeDirection}>
					<FontAwesomeIcon icon={faArrowDown} className="w-6 h-6" />
				</Button>
			</div>

			<TokenInputSelect
				digit={toTokenMeta.decimals}
				max={toTokenMeta.userBal}
				symbol={toTokenMeta.symbol}
				symbolOptions={toOptions}
				symbolOnChange={(o) => onSetToSymbol(o.value)}
				output={outputAmount}
				note={`1 ${fromSymbol} = 1 ${toSymbol}`}
				label="Receive"
			/>

			<div className="mx-auto my-4 w-72 max-w-full flex-col">
				<div className="w-full text-sm text-center mb-6">This operation requires {steps.length} transactions</div>
				<GuardToAllowedChainBtn>
					<Button disabled={amount == 0n || !!error || isDone} isLoading={isTxOnGoing} onClick={handleStartSwap} className={`${isDone ? "bg-text-success" : ""}`}>
						{isDone 
							? "Done" 
							: isTxOnGoing 
							? steps[currentStep].name
							: currentStep === -1 
							? "Start Swap" 
							: "Continue Swap"
						}
					</Button>
				</GuardToAllowedChainBtn>
				<div className="mt-8 flex flex-col items-center">
					<HorizontalStepper currentStep={currentStep} steps={steps} isStepLoading={isTxOnGoing} />
				</div>
			</div>
		</AppCard>
	);
}
