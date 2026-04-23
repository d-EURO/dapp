import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Address, decodeEventLog, erc20Abi, formatUnits, type Log, type TransactionReceipt, zeroAddress } from "viem";
import { faCircleQuestion } from "@fortawesome/free-solid-svg-icons";
import AppCard from "@components/AppCard";
import Button from "@components/Button";
import { TokenInputSelectOutlined } from "@components/Input/TokenInputSelectOutlined";
import { DateInputOutlined } from "@components/Input/DateInputOutlined";
import { SliderInputOutlined } from "@components/Input/SliderInputOutlined";
import { DetailsExpandablePanel } from "@components/PageMint/DetailsExpandablePanel";
import { NormalInputOutlined } from "@components/Input/NormalInputOutlined";
import { PositionQuery } from "@deuro/api";
import { SelectCollateralModal } from "./SelectCollateralModal";
import { BorrowingDEUROModal } from "@components/PageMint/BorrowingDEUROModal";
import { InputTitle } from "@components/Input/InputTitle";
import { formatBigInt, formatCurrency, shortenAddress, toDate, TOKEN_SYMBOL, toTimestamp, WHITELISTED_POSITIONS } from "@utils";
import { TokenBalance, useWalletERC20Balances } from "../../hooks/useWalletBalances";
import { RootState, store } from "../../redux/redux.store";
import GuardToAllowedChainBtn from "@components/Guards/GuardToAllowedChainBtn";
import { useTranslation } from "next-i18next";
import { useAccount, useBlock, useChainId } from "wagmi";
import { DEURO_API_CLIENT, WAGMI_CONFIG } from "../../app.config";
import { waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { TxToast } from "@components/TxToast";
import { toast } from "react-toastify";
import { renderErrorTxToast } from "@components/TxToast";
import { fetchPositionsList } from "../../redux/slices/positions.slice";
import {
	LoanDetails,
	getLoanDetailsByCollateralAndYouGetAmount,
	getLoanDetailsByCollateralAndStartingLiqPrice,
} from "../../utils/loanCalculations";
import { MaxButton } from "@components/Input/MaxButton";
import { useRouter } from "next/router";
import Link from "next/link";
import { getAppAddresses, MintingHubGatewayV2ABI, MintingHubV3ABI, PositionV2ABI } from "@contracts";
import { useFrontendCode } from "../../hooks/useFrontendCode";

const getMaxCollateralFromMintLimit = (availableForClones: bigint, liqPrice: bigint) => {
	if (!availableForClones || liqPrice === 0n) return 0n;
	return (availableForClones * BigInt(1e18)) / liqPrice;
};

const getMaxCollateralAmount = (balance: bigint, availableForClones: bigint, liqPrice: bigint) => {
	const maxFromLimit = getMaxCollateralFromMintLimit(availableForClones, liqPrice);
	return maxFromLimit > 0n && balance > maxFromLimit ? maxFromLimit : balance;
};

type BestCloneableResponse = { position: PositionQuery | null };

export default function PositionCreate({}) {
	const [selectedCollateral, setSelectedCollateral] = useState<TokenBalance | null | undefined>(null);
	const [selectedPosition, setSelectedPosition] = useState<PositionQuery | null | undefined>(null);
	const [expirationDate, setExpirationDate] = useState<Date | undefined | null>(undefined);
	const [collateralAmount, setCollateralAmount] = useState("0");
	const [liquidationPrice, setLiquidationPrice] = useState("0");
	const [borrowedAmount, setBorrowedAmount] = useState("0");
	const [isOpenTokenSelector, setIsOpenTokenSelector] = useState(false);
	const [isOpenBorrowingDEUROModal, setIsOpenBorrowingDEUROModal] = useState(false);
	const [loanDetails, setLoanDetails] = useState<LoanDetails | undefined>(undefined);
	const [isApproving, setIsApproving] = useState(false);
	const [isCloneSuccess, setIsCloneSuccess] = useState(false);
	const [isCloneLoading, setIsCloneLoading] = useState(false);
	const [collateralError, setCollateralError] = useState("");
	const [isMaxedOut, setIsMaxedOut] = useState(false);
	const [noCloneableParent, setNoCloneableParent] = useState(false);

	const positions = useSelector((state: RootState) => state.positions.list?.list || []);
	const challenges = useSelector((state: RootState) => state.challenges.list?.list || []);
	const challengedPositions = useMemo(
		() => (challenges || []).filter((c) => c.status === "Active").map((c) => c.position.toLowerCase()),
		[challenges]
	);

	const { data: latestBlock } = useBlock();
	const chainId = useChainId();
	const { address } = useAccount();
	const router = useRouter();
	const { query } = router;
	const ADDR = getAppAddresses(chainId);
	const { frontendCode } = useFrontendCode();

	const elegiblePositions = useMemo(() => {
		const blockTimestamp = latestBlock?.timestamp || new Date().getTime() / 1000;
		return positions
			.filter((p) => WHITELISTED_POSITIONS.includes(p.position))
			.filter((p) => BigInt(p.availableForClones) > 0n)
			.filter((p) => !p.closed && !p.denied)
			.filter((p) => blockTimestamp > toTimestamp(toDate(p.cooldown)))
			.filter((p) => blockTimestamp < toTimestamp(toDate(p.expiration)))
			.filter((p) => !challengedPositions.includes(p.position.toLowerCase()));
	}, [positions, latestBlock, challengedPositions]);

	const collateralTokenList = useMemo(() => {
		const uniqueTokens = new Map();
		elegiblePositions.forEach((p) => {
			uniqueTokens.set(p.collateral.toLowerCase(), {
				symbol: p.collateralSymbol,
				address: p.collateral,
				name: p.collateralName,
				allowance: [ADDR.mintingHub, ADDR.mintingHubGateway],
				decimals: p.collateralDecimals,
				position: p.position,
			});
		});

		const tokens = Array.from(uniqueTokens.values()).sort((a, b) => {
			const posA = WHITELISTED_POSITIONS.findIndex((position) => position.toLowerCase() === a.position.toLowerCase());
			const posB = WHITELISTED_POSITIONS.findIndex((position) => position.toLowerCase() === b.position.toLowerCase());
			if (posA === -1 || posB === -1) return 0;
			return posA - posB;
		});

		// Check if WETH is in the list and add ETH option
		const wethToken = tokens.find((t) => t.symbol.toLowerCase() === "weth");
		const hasNativeEthPath = elegiblePositions.some((p) => p.version === 3 && p.collateralSymbol.toLowerCase() === "weth");
		if (wethToken && hasNativeEthPath) {
			// Add ETH as the first option when WETH is available
			// Use a special ETH address (0x0) to distinguish it from WETH
			const ethToken = {
				...wethToken,
				symbol: "ETH",
				name: "Ethereum",
				address: "0x0000000000000000000000000000000000000000" as Address, // Use zero address for ETH
				isNative: true, // Flag to identify native ETH
			};
			tokens.unshift(ethToken);
		}

		return tokens;
	}, [ADDR.mintingHub, ADDR.mintingHubGateway, elegiblePositions]);

	const { balances, balancesByAddress, refetchBalances } = useWalletERC20Balances(collateralTokenList);
	const { t } = useTranslation();

	// Resolve the underlying ERC20 collateral address for the API lookup.
	// For the native-ETH alias (address === zeroAddress), fall back to the WETH entry in the token list.
	const resolveCollateralAddress = useCallback((token: TokenBalance): Address | null => {
		if (token.address !== zeroAddress) return token.address as Address;
		const weth = collateralTokenList.find((t) => t.symbol.toLowerCase() === "weth");
		return weth ? (weth.address as Address) : null;
	}, [collateralTokenList]);

	// Apply a parent position to the derived form state (amount, expiration, liq price, loan details).
	const applyParentPosition = useCallback((token: TokenBalance, position: PositionQuery) => {
		const liqPrice = BigInt(position.price);
		setSelectedPosition(position);

		const tokenBalance = balancesByAddress[token.address]?.balanceOf || 0n;
		const maxAmount = getMaxCollateralAmount(tokenBalance, BigInt(position.availableForClones), liqPrice);
		const defaultAmount = maxAmount > BigInt(position.minimumCollateral) ? maxAmount.toString() : position.minimumCollateral;

		setCollateralAmount(defaultAmount);
		setExpirationDate(toDate(position.expiration));
		setLiquidationPrice(liqPrice.toString());

		const details = getLoanDetailsByCollateralAndStartingLiqPrice(position, BigInt(maxAmount), liqPrice, toDate(position.expiration));
		setLoanDetails(details);
		setBorrowedAmount(details.amountToSendToWallet.toString());
	}, [balancesByAddress]);

	// Fetch the single best cloneable parent for the selected collateral — V3-preferred, V2 fallback.
	// Guarded by lastAppliedCollateralRef so we only fetch+apply when the user actually switches collateral.
	// Upstream deps (balancesByAddress, collateralTokenList) change on every render, so without this guard
	// the effect would re-fire continuously and clobber user-typed amount/expiration/price on each response.
	const lastAppliedCollateralRef = useRef<string | null>(null);
	useEffect(() => {
		if (!selectedCollateral) {
			setSelectedPosition(null);
			setNoCloneableParent(false);
			lastAppliedCollateralRef.current = null;
			return;
		}

		const selectedKey = selectedCollateral.address.toLowerCase();
		if (lastAppliedCollateralRef.current === selectedKey) return;

		const collateralAddress = resolveCollateralAddress(selectedCollateral);
		if (!collateralAddress) {
			setSelectedPosition(null);
			setNoCloneableParent(true);
			lastAppliedCollateralRef.current = selectedKey;
			return;
		}

		let cancelled = false;
		(async () => {
			try {
				const response = await DEURO_API_CLIENT.get<BestCloneableResponse>(
					`/positions/best-cloneable?collateral=${collateralAddress}`
				);
				if (cancelled) return;

				const candidate = response.data?.position ?? null;
				if (!candidate) {
					setSelectedPosition(null);
					setNoCloneableParent(true);
				} else {
					setNoCloneableParent(false);
					applyParentPosition(selectedCollateral, candidate);
				}
				lastAppliedCollateralRef.current = selectedKey;
			} catch (err) {
				if (cancelled) return;
				console.error("Failed to fetch best-cloneable parent:", err);
				setSelectedPosition(null);
				setNoCloneableParent(true);
				lastAppliedCollateralRef.current = selectedKey;
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [selectedCollateral, resolveCollateralAddress, applyParentPosition]);

	// Genesis expiration cap — contract enforces _expiration <= Position(original).expiration().
	const genesisPosition = useMemo(() => {
		if (!selectedPosition) return null;
		if (selectedPosition.position.toLowerCase() === selectedPosition.original.toLowerCase()) return selectedPosition;
		return positions.find((p) => p.position.toLowerCase() === selectedPosition.original.toLowerCase()) ?? null;
	}, [selectedPosition, positions]);

	// Collateral input validation with minting limit check
	useEffect(() => {
		if (!selectedPosition || !selectedCollateral) return;

		setIsMaxedOut(false);
		setCollateralError("");

		const balanceInWallet = balancesByAddress[selectedCollateral?.address];

		const maxFromLimit = getMaxCollateralFromMintLimit(
			BigInt(selectedPosition.availableForClones),
			BigInt(liquidationPrice || selectedPosition.price)
		);

		if (maxFromLimit < BigInt(selectedPosition.minimumCollateral)) {
			setIsMaxedOut(true);
		} else if (collateralAmount === "" || !address) {
			return;
		} else if (BigInt(collateralAmount) < BigInt(selectedPosition.minimumCollateral)) {
			const minColl = formatBigInt(BigInt(selectedPosition?.minimumCollateral || 0n), selectedPosition?.collateralDecimals || 0);
			const notTheMinimum = `${t("mint.error.must_be_at_least_the_minimum_amount")} (${minColl} ${
				selectedPosition?.collateralSymbol
			})`;
			setCollateralError(notTheMinimum);
		} else if (BigInt(collateralAmount) > BigInt(balanceInWallet?.balanceOf || 0n)) {
			const notEnoughBalance = t("common.error.insufficient_balance", { symbol: selectedPosition?.collateralSymbol });
			setCollateralError(notEnoughBalance);
		} else if (maxFromLimit > 0n && BigInt(collateralAmount) > maxFromLimit) {
			const maxColl = formatBigInt(maxFromLimit, selectedPosition?.collateralDecimals || 0);
			const availableToMint = formatBigInt(BigInt(selectedPosition.availableForClones), 18);
			const limitExceeded = t("mint.error.global_minting_limit_exceeded", {
				maxCollateral: maxColl,
				collateralSymbol: selectedPosition?.collateralSymbol,
				maxMint: availableToMint,
				mintSymbol: TOKEN_SYMBOL,
			});
			setCollateralError(limitExceeded);
		}
	}, [collateralAmount, balancesByAddress, address, selectedCollateral, selectedPosition, liquidationPrice, t]);

	const prices = useSelector((state: RootState) => state.prices.coingecko || {});
	const eurPrice = useSelector((state: RootState) => state.prices.eur?.usd);
	const collateralPriceDeuro = prices[selectedPosition?.collateral.toLowerCase() as Address]?.price?.eur || 0;

	const collateralPriceUsd = prices[selectedPosition?.collateral.toLowerCase() as Address]?.price?.usd || 0;
	const collateralEurValue = selectedPosition
		? formatCurrency(
				collateralPriceDeuro * parseFloat(formatUnits(BigInt(collateralAmount), selectedPosition.collateralDecimals)),
				2,
				2
		  )
		: 0;
	const collateralUsdValue = selectedPosition
		? formatCurrency(collateralPriceUsd * parseFloat(formatUnits(BigInt(collateralAmount), selectedPosition.collateralDecimals)), 2, 2)
		: 0;
	const maxLiquidationPrice = selectedPosition ? BigInt(selectedPosition.price) : 0n;
	const isLiquidationPriceTooHigh = selectedPosition ? BigInt(liquidationPrice) > maxLiquidationPrice : false;
	// For ETH, we check ETH balance directly. For other tokens, use the normal ERC20 balance
	const isETH = selectedCollateral?.symbol === 'ETH';
	const approvalTarget = selectedPosition?.version === 3 ? ADDR.mintingHub : ADDR.mintingHubGateway;
	const collateralUserBalance = isETH
		? balances.find((b) => b.symbol === 'ETH')
		: balances.find((b) => b.address == selectedCollateral?.address);

	// For ETH, we check WETH allowance after wrapping. Initially it's 0.
	const userAllowance = isETH ? 0n : (approvalTarget ? collateralUserBalance?.allowance?.[approvalTarget] || 0n : 0n);
	const userBalance = collateralUserBalance?.balanceOf || 0n;
	const selectedBalance = Boolean(selectedCollateral) ? balancesByAddress[selectedCollateral?.address as Address] : null;
	const usdLiquidationPrice = formatCurrency(
		parseFloat(formatUnits(BigInt(liquidationPrice), 36 - (selectedPosition?.collateralDecimals || 0))) * (eurPrice || 0),
		2,
		2
	)?.toString();

	const handleOnSelectedToken = useCallback((token: TokenBalance) => {
		if (!token) return;
		setSelectedCollateral(token);
		const currentQuery = { ...router.query, collateral: token.symbol };
		router.replace({
			pathname: router.pathname,
			query: currentQuery,
		});
	}, [router]);

	useEffect(() => {
		if (collateralTokenList.length > 0 && !selectedCollateral) {
			if (query?.collateral) {
				// If collateral is specified in URL, use it
				const queryCollateral = Array.isArray(query.collateral) ? query.collateral[0] : query.collateral;
				const collateralToken = collateralTokenList.find((b) => b.symbol.toLowerCase() === queryCollateral?.toLowerCase());
				if (collateralToken) {
					handleOnSelectedToken(collateralToken);
				}
			} else {
				// If no collateral specified, prefer ETH if available, otherwise first token
				const ethToken = collateralTokenList.find((b) => b.symbol === 'ETH');
				if (ethToken) {
					handleOnSelectedToken(ethToken);
				} else if (collateralTokenList.length > 0) {
					handleOnSelectedToken(collateralTokenList[0]);
				}
			}
		}
	}, [query?.collateral, collateralTokenList, selectedCollateral, handleOnSelectedToken]);

	const onAmountCollateralChange = (value: string) => {
		setCollateralAmount(value);
		if (!selectedPosition) return;

		const loanDetails = getLoanDetailsByCollateralAndStartingLiqPrice(selectedPosition, BigInt(value), BigInt(liquidationPrice), expirationDate || undefined);
		setLoanDetails(loanDetails);
		setBorrowedAmount(loanDetails.amountToSendToWallet.toString());
	};

	const onLiquidationPriceChange = (value: string) => {
		setLiquidationPrice(value);

		if (!selectedPosition) return;
		if (!collateralAmount || collateralAmount === "" || collateralAmount === "0") return;

		const loanDetails = getLoanDetailsByCollateralAndStartingLiqPrice(selectedPosition, BigInt(collateralAmount), BigInt(value), expirationDate || undefined);
		setLoanDetails(loanDetails);
		setBorrowedAmount(loanDetails.amountToSendToWallet.toString());
	};

	const onYouGetChange = (value: string) => {
		setBorrowedAmount(value);

		if (!selectedPosition) return;

		const loanDetails = getLoanDetailsByCollateralAndYouGetAmount(selectedPosition, BigInt(collateralAmount), BigInt(value), expirationDate || undefined);
		setLoanDetails(loanDetails);
		setLiquidationPrice(loanDetails.startingLiquidationPrice.toString());
	};

	useEffect(() => {
		if (!selectedPosition || !collateralAmount || !liquidationPrice || !expirationDate) return;

		const loanDetails = getLoanDetailsByCollateralAndStartingLiqPrice(
			selectedPosition,
			BigInt(collateralAmount),
			BigInt(liquidationPrice),
			expirationDate
		);
		setLoanDetails(loanDetails);
		setBorrowedAmount(loanDetails.amountToSendToWallet.toString());
	}, [collateralAmount, expirationDate, liquidationPrice, selectedPosition]);

	const handleMaxExpirationDate = () => {
		const maxExp = genesisPosition?.expiration ?? selectedPosition?.expiration;
		if (maxExp) {
			setExpirationDate(toDate(maxExp));
		}
	};

	const parseCloneEventLogs = (logs: Log[]): Address | null => {
		const hubAddr = ADDR.mintingHubGateway.toLowerCase();
		const cloneEventLog = logs.find((log) => log.address.toLowerCase() === hubAddr);
		if (!cloneEventLog) return null;
		try {
			const decoded = decodeEventLog({
				abi: MintingHubGatewayV2ABI,
				data: cloneEventLog.data,
				topics: cloneEventLog.topics,
			});
			if (decoded.eventName === "PositionOpened") {
				return (decoded.args as { position: Address }).position;
			}
		} catch {
			return null;
		}
		return null;
	};

	const handleOnClonePosition = async () => {
		try {
			if (!selectedPosition || !loanDetails || !expirationDate || !address) return;

			setIsOpenBorrowingDEUROModal(true);
			setIsCloneLoading(true);
			setIsCloneSuccess(false);

			const cloneWriteHash = await writeContract(WAGMI_CONFIG, {
				address: selectedPosition.version === 3 ? ADDR.mintingHub : ADDR.mintingHubGateway,
				abi: selectedPosition.version === 3 ? MintingHubV3ABI : MintingHubGatewayV2ABI,
				functionName: "clone",
				args:
					selectedPosition.version === 3
						? [
								address,
								selectedPosition.position,
								BigInt(collateralAmount),
								loanDetails.loanAmount,
								toTimestamp(expirationDate),
								BigInt(liquidationPrice),
						  ]
						: [
								address,
								selectedPosition.position,
								BigInt(collateralAmount),
								loanDetails.loanAmount,
								toTimestamp(expirationDate),
								frontendCode,
						  ],
			});

			const toastContent = [
				{
					title: t("common.txs.amount"),
					value: formatBigInt(loanDetails.loanAmount) + ` ${TOKEN_SYMBOL}`,
				},
				{
					title: t("common.txs.collateral"),
					value:
						formatBigInt(BigInt(collateralAmount), selectedPosition.collateralDecimals) +
						" " +
						selectedPosition.collateralSymbol,
				},
				{
					title: t("common.txs.transaction"),
					hash: cloneWriteHash,
				},
			];

			// For V2, the clone call cannot accept a custom liquidation price — inherit parent's.
			// If the user picked a different price on the slider, follow up with Position.adjustPrice.
			// Slider is capped at parent.price so only decreases are possible — no 3-day cooldown.
			let txHash: `0x${string}` = cloneWriteHash;
			const receipt: TransactionReceipt = await waitForTransactionReceipt(WAGMI_CONFIG, {
				hash: cloneWriteHash,
				confirmations: 1,
			});

			if (
				selectedPosition.version !== 3 &&
				BigInt(liquidationPrice) !== BigInt(selectedPosition.price)
			) {
				const newPositionAddress = parseCloneEventLogs(receipt.logs);
				if (newPositionAddress) {
					const adjustPriceHash = await writeContract(WAGMI_CONFIG, {
						address: newPositionAddress,
						abi: PositionV2ABI,
						functionName: "adjustPrice",
						// +0.01% buffer covers one block of accrued interest between the two txs
						args: [(BigInt(liquidationPrice) * 10001n) / 10000n],
					});
					txHash = adjustPriceHash;
				}
			}

			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: txHash, confirmations: 1 }), {
				pending: {
					render: <TxToast title={t("mint.txs.minting", { symbol: TOKEN_SYMBOL })} rows={toastContent} />,
				},
				success: {
					render: <TxToast title={t("mint.txs.minting_success", { symbol: TOKEN_SYMBOL })} rows={toastContent} />,
				},
			});

			store.dispatch(fetchPositionsList());
			setIsCloneSuccess(true);
			await refetchBalances();
		} catch (error) {
			toast.error(renderErrorTxToast(error, t));
			setIsOpenBorrowingDEUROModal(false);
		} finally {
			setIsCloneLoading(false);
			refetchBalances();
		}
	};

	const handleApprove = async () => {
		try {
			setIsApproving(true);

			const approveWriteHash = await writeContract(WAGMI_CONFIG, {
				address: selectedCollateral?.address as Address,
				abi: erc20Abi,
				functionName: "approve",
				args: [approvalTarget, BigInt(collateralAmount)],
			});

			const toastContent = [
				{
					title: t("common.txs.amount"),
					value:
						formatCurrency(formatUnits(BigInt(collateralAmount), selectedCollateral?.decimals || 18)) +
						" " +
						selectedCollateral?.symbol,
				},
				{
					title: t("common.txs.spender"),
					value: shortenAddress(approvalTarget),
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
		} catch (error) {
			toast.error(renderErrorTxToast(error, t));
		} finally {
			setIsApproving(false);
			refetchBalances();
		}
	};

	const handleWrapETHAndMint = async () => {
		try {
			if (!selectedPosition || !loanDetails || !expirationDate || !address) return;

			// Validate inputs
			if (BigInt(collateralAmount) <= 0n) {
				toast.error(t("mint.collateral_amount_zero"));
				return;
			}

			if (userBalance < BigInt(collateralAmount)) {
				toast.error(t("mint.insufficient_balance", { symbol: "ETH" }));
				return;
			}

			setIsOpenBorrowingDEUROModal(true);
			setIsCloneLoading(true);
			setIsCloneSuccess(false);

			const hash = await writeContract(WAGMI_CONFIG, {
				address: ADDR.mintingHub,
				abi: MintingHubV3ABI,
				functionName: "clone",
				args: [
					address,
					selectedPosition.position,
					BigInt(collateralAmount),
					loanDetails.loanAmount,
					toTimestamp(expirationDate),
					BigInt(liquidationPrice),
				],
				value: BigInt(collateralAmount),
			});

			const toastContent = [
				{
					title: t("common.txs.amount"),
					value: formatBigInt(loanDetails.loanAmount) + ` ${TOKEN_SYMBOL}`,
				},
				{
					title: t("common.txs.collateral"),
					value: formatBigInt(BigInt(collateralAmount), 18) + " ETH",
				},
				{
					title: t("common.txs.transaction"),
					hash,
				},
			];

			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash, confirmations: 1 }), {
				pending: {
					render: <TxToast title={t("mint.txs.minting", { symbol: TOKEN_SYMBOL })} rows={toastContent} />,
				},
				success: {
					render: <TxToast title={t("mint.txs.minting_success", { symbol: TOKEN_SYMBOL })} rows={toastContent} />,
				},
			});

			store.dispatch(fetchPositionsList());
			setIsCloneSuccess(true);
			await refetchBalances();
		} catch (error) {
			toast.error(renderErrorTxToast(error, t));
			setIsOpenBorrowingDEUROModal(false);
		} finally {
			setIsCloneLoading(false);
			refetchBalances();
		}
	};

	return (
		<div className="md:mt-8 flex justify-center">
			<div className="max-w-lg w-[32rem]">
				<AppCard className="w-full p-4 flex-col justify-start items-center gap-8 flex">
					<div className="self-stretch justify-center items-center gap-1.5 inline-flex">
						<div className="text-text-title text-xl font-black ">{t("mint.mint_title_2", { symbol: TOKEN_SYMBOL })}</div>
					</div>
					<div className="self-stretch flex-col justify-start items-center gap-1 flex">
						<InputTitle icon={faCircleQuestion}>{t("mint.select_collateral")}</InputTitle>
						<TokenInputSelectOutlined
							selectedToken={selectedCollateral}
							onSelectTokenClick={() => setIsOpenTokenSelector(true)}
							value={collateralAmount}
							onChange={onAmountCollateralChange}
							isError={Boolean(collateralError)}
							errorMessage={collateralError}
							adornamentRow={
								<div className="self-stretch justify-start items-center inline-flex">
									<div className="grow shrink basis-0 h-4 px-2 justify-start items-center gap-2 flex max-w-full overflow-hidden">
										<div className="text-input-label text-xs font-medium leading-none">€{collateralEurValue}</div>
										<div className="h-4 w-0.5 border-l border-input-placeholder"></div>
										<div className="text-input-label text-xs font-medium leading-none">${collateralUsdValue}</div>
									</div>
									<div className="h-7 justify-end items-center gap-2.5 flex">
										{selectedBalance && selectedPosition && (
											<>
												<div className="text-input-label text-xs font-medium leading-none">
													{formatUnits(
														getMaxCollateralAmount(
															selectedBalance.balanceOf || 0n,
															BigInt(selectedPosition.availableForClones),
															BigInt(liquidationPrice || selectedPosition.price)
														),
														selectedBalance.decimals || 18
													)}{" "}
													{selectedBalance.symbol}
												</div>
												<MaxButton
													disabled={BigInt(selectedBalance.balanceOf || 0n) === BigInt(0)}
													onClick={() => {
														const maxAmount = getMaxCollateralAmount(
															selectedBalance.balanceOf || 0n,
															BigInt(selectedPosition.availableForClones),
															BigInt(liquidationPrice || selectedPosition.price)
														);
														onAmountCollateralChange(maxAmount.toString());
													}}
												/>
											</>
										)}
									</div>
								</div>
							}
						/>
						{isMaxedOut && selectedPosition && (
							<div className="self-stretch mt-1 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-md">
								<div className="text-yellow-800 text-sm font-medium">
									⚠️ {t("mint.error.position_unavailable_limit_exhausted", {
										available: formatCurrency(formatUnits(BigInt(selectedPosition.availableForClones), 18), 2, 2),
										symbol: TOKEN_SYMBOL,
										minCollateral: formatBigInt(BigInt(selectedPosition.minimumCollateral), selectedPosition.collateralDecimals),
										collateralSymbol: selectedPosition.collateralSymbol
									})}
								</div>
							</div>
						)}
						{noCloneableParent && selectedCollateral && (
							<div className="self-stretch mt-1 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-md">
								<div className="text-yellow-800 text-sm font-medium">
									⚠️ {t("mint.error.no_cloneable_parent", { symbol: selectedCollateral.symbol })}
								</div>
							</div>
						)}
						<SelectCollateralModal
							title={t("mint.token_select_modal_title")}
							isOpen={isOpenTokenSelector}
							setIsOpen={setIsOpenTokenSelector}
							options={balances}
							onTokenSelect={handleOnSelectedToken}
						/>
					</div>
					<div className="self-stretch flex-col justify-start items-center gap-1 flex">
						<InputTitle icon={faCircleQuestion}>{t("mint.select_liquidation_price")}</InputTitle>
						<SliderInputOutlined
							value={liquidationPrice}
							onChange={onLiquidationPriceChange}
							min={BigInt(0)}
							max={maxLiquidationPrice}
							decimals={36 - (selectedPosition?.collateralDecimals || 0)}
							isError={isLiquidationPriceTooHigh}
							errorMessage={t("mint.liquidation_price_too_high")}
							usdPrice={usdLiquidationPrice}
						/>
					</div>
					<div className="self-stretch flex-col justify-start items-center gap-1.5 flex">
						<InputTitle>{t("mint.set_expiration_date")}</InputTitle>
						<DateInputOutlined
							value={expirationDate}
							maxDate={
								genesisPosition?.expiration
									? toDate(genesisPosition.expiration)
									: selectedPosition?.expiration
									? toDate(selectedPosition.expiration)
									: expirationDate
							}
							placeholderText="YYYY-MM-DD"
							onChange={setExpirationDate}
							rightAdornment={expirationDate ? <MaxButton onClick={handleMaxExpirationDate} /> : null}
						/>
						<div className="self-stretch text-xs font-medium leading-normal">{t("mint.expiration_date_description")}</div>
					</div>
					<div className="self-stretch flex-col justify-start items-start gap-4 flex">
						<div className="self-stretch flex-col justify-start items-center gap-1.5 flex">
							<InputTitle>{t("mint.you_get")}</InputTitle>
							<NormalInputOutlined value={borrowedAmount} onChange={onYouGetChange} decimals={18} />
						</div>
						<DetailsExpandablePanel
							loanDetails={loanDetails}
							startingLiquidationPrice={BigInt(liquidationPrice)}
							collateralDecimals={selectedPosition?.collateralDecimals || 0}
							collateralPriceDeuro={collateralPriceDeuro}
							extraRows={
								<div className="py-1.5 flex justify-between">
									<span className="text-base leading-tight">{t("mint.parent_position")}</span>
									<Link
										className="underline text-right text-sm font-extrabold leading-none tracking-tight"
										href={`/monitoring/${selectedPosition?.position}`}
									>
										{shortenAddress(selectedPosition?.position || zeroAddress)}
									</Link>
								</div>
							}
						/>
					</div>
					<GuardToAllowedChainBtn label={t("mint.symbol_borrow", { symbol: TOKEN_SYMBOL })}>
						{!selectedCollateral ? (
							<Button
								className="!p-4 text-lg font-extrabold leading-none"
								onClick={handleOnClonePosition}
								disabled={!selectedPosition || !selectedCollateral || isLiquidationPriceTooHigh || isMaxedOut || noCloneableParent}
							>
								{t("common.receive") + " 0.00 " + TOKEN_SYMBOL}
							</Button>
						) : selectedCollateral.symbol === 'ETH' ? (
							// Special handling for ETH - wrap, approve and mint in one click.
							// Requires V3 parent: handleWrapETHAndMint calls V3 MintingHub with msg.value.
							// If best-cloneable falls back to V2 (e.g. V3 WETH has no capacity), block the flow.
							<Button
								className="!p-4 text-lg font-extrabold leading-none"
								onClick={handleWrapETHAndMint}
								disabled={
									!selectedPosition ||
									selectedPosition.version !== 3 ||
									!selectedCollateral ||
									isLiquidationPriceTooHigh ||
									!!collateralError ||
									isMaxedOut ||
									noCloneableParent ||
									userBalance < BigInt(collateralAmount)
								}
							>
								{isLiquidationPriceTooHigh
									? t("mint.your_liquidation_price_is_too_high")
									: t("common.receive") + " " + formatCurrency(formatUnits(BigInt(borrowedAmount), 18), 2) + " " + TOKEN_SYMBOL}
							</Button>
						) : userAllowance >= BigInt(collateralAmount) ? (
							<Button
								className="!p-4 text-lg font-extrabold leading-none"
								onClick={handleOnClonePosition}
								disabled={
									!selectedPosition ||
									!selectedCollateral ||
									isLiquidationPriceTooHigh ||
									!!collateralError ||
									isMaxedOut ||
									noCloneableParent ||
									userBalance < BigInt(collateralAmount)
								}
							>
								{isLiquidationPriceTooHigh
									? t("mint.your_liquidation_price_is_too_high")
									: t("common.receive") + " " + formatCurrency(formatUnits(BigInt(borrowedAmount), 18), 2)}
							</Button>
						) : (
							<Button
								className="!p-4 text-lg font-extrabold leading-none"
								onClick={handleApprove}
								isLoading={isApproving}
								disabled={!!collateralError || isMaxedOut || noCloneableParent}
							>
								{t("common.approve")}
							</Button>
						)}
					</GuardToAllowedChainBtn>
					<BorrowingDEUROModal
						isOpen={isOpenBorrowingDEUROModal}
						setIsOpen={setIsOpenBorrowingDEUROModal}
						youGet={formatCurrency(formatUnits(BigInt(borrowedAmount), 18), 2)}
						liquidationPrice={formatCurrency(
							formatUnits(BigInt(liquidationPrice), 36 - (selectedPosition?.collateralDecimals || 0)),
							2
						)}
						expiration={expirationDate}
						formmatedCollateral={`${formatUnits(BigInt(collateralAmount), selectedPosition?.collateralDecimals || 0)} ${
							selectedPosition?.collateralSymbol
						}`}
						collateralPriceDeuro={collateralEurValue || "0"}
						isSuccess={isCloneSuccess}
						isLoading={isCloneLoading}
						usdLiquidationPrice={usdLiquidationPrice}
					/>
				</AppCard>
			</div>
		</div>
	);
}
