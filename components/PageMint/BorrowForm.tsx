import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Address, formatUnits, zeroAddress } from "viem";
import { faCircleQuestion } from "@fortawesome/free-solid-svg-icons";
import AppCard from "@components/AppCard";
import Button from "@components/Button";
import { TokenInputSelectOutlined } from "@components/Input/TokenInputSelectOutlined";
import { DateInputOutlined } from "@components/Input/DateInputOutlined";
import { SliderInputOutlined } from "@components/Input/SliderInputOutlined";
import { DetailsExpandablePanel } from "@components/PageMint/DetailsExpandablePanel";
import { NormalInputOutlined } from "@components/Input/NormalInputOutlined";
import { PositionQuery } from "@juicedollar/api";
import { BorrowingDEUROModal } from "@components/PageMint/BorrowingDEUROModal";
import { SelectCollateralModal } from "./SelectCollateralModal";
import { InputTitle } from "@components/Input/InputTitle";
import {
	formatBigInt,
	formatCurrency,
	shortenAddress,
	toDate,
	TOKEN_SYMBOL,
	toTimestamp,
	NATIVE_WRAPPED_SYMBOLS,
	normalizeTokenSymbol,
} from "@utils";
import { TokenBalance, useWalletERC20Balances } from "../../hooks/useWalletBalances";
import { RootState, store } from "../../redux/redux.store";
import GuardToAllowedChainBtn from "@components/Guards/GuardToAllowedChainBtn";
import { useTranslation } from "next-i18next";
import { ADDRESS, MintingHubGatewayABI } from "@juicedollar/jusd";
import { useAccount, useChainId } from "wagmi";
import { API_CLIENT, WAGMI_CONFIG, WAGMI_CHAIN } from "../../app.config";
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
import { useFrontendCode } from "../../hooks/useFrontendCode";
import { MaxButton } from "@components/Input/MaxButton";
import Link from "next/link";

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
	const [isCloneSuccess, setIsCloneSuccess] = useState(false);
	const [isCloneLoading, setIsCloneLoading] = useState(false);
	const [collateralError, setCollateralError] = useState("");
	const [isMaxedOut, setIsMaxedOut] = useState(false);
	const [defaultPosition, setDefaultPosition] = useState<PositionQuery | null>(null);

	const chainId = useChainId();
	const { address } = useAccount();

	const getMaxCollateralFromMintLimit = (availableForClones: bigint, liqPrice: bigint) => {
		if (!availableForClones || liqPrice === 0n) return 0n;
		return (availableForClones * BigInt(1e18)) / liqPrice;
	};

	const getMaxCollateralAmount = (balance: bigint, availableForClones: bigint, liqPrice: bigint) => {
		const maxFromLimit = getMaxCollateralFromMintLimit(availableForClones, liqPrice);
		return maxFromLimit > 0n && balance > maxFromLimit ? maxFromLimit : balance;
	};

	const collateralTokenList = useMemo(() => {
		if (!defaultPosition) return [];

		return [
			{
				symbol: WAGMI_CHAIN.nativeCurrency.symbol,
				address: "0x0000000000000000000000000000000000000000" as Address,
				name: WAGMI_CHAIN.nativeCurrency.name,
				allowance: [ADDRESS[chainId].mintingHubGateway],
				decimals: defaultPosition.collateralDecimals,
			},
		];
	}, [defaultPosition, chainId]);

	const { balances, balancesByAddress, refetchBalances } = useWalletERC20Balances(collateralTokenList);
	const collateralSelectorOptions = selectedCollateral ? [selectedCollateral] : [];
	const { frontendCode } = useFrontendCode();
	const { t } = useTranslation();

	useEffect(() => {
		const loadDefaultPosition = async () => {
			try {
				const response = await API_CLIENT.get<PositionQuery>("/positions/default");
				const position = response.data as PositionQuery;

				if (!NATIVE_WRAPPED_SYMBOLS.includes(position.collateralSymbol.toLowerCase())) {
					console.warn("Default position collateral is not a wrapped-native asset:", position.collateralSymbol);
				}

				setDefaultPosition(position);

				const nativeToken: TokenBalance = {
					symbol: WAGMI_CHAIN.nativeCurrency.symbol,
					name: WAGMI_CHAIN.nativeCurrency.name,
					address: "0x0000000000000000000000000000000000000000" as Address,
					decimals: position.collateralDecimals,
					balanceOf: 0n,
					allowance: {},
				};

				handleOnSelectedToken(nativeToken, position);
			} catch (error) {
				console.error("Error loading default position:", error);
			}
		};

		loadDefaultPosition();
	}, []);

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
			const notTheMinimum = `${t("mint.error.must_be_at_least_the_minimum_amount")} (${minColl} ${normalizeTokenSymbol(
				selectedPosition?.collateralSymbol || ""
			)})`;
			setCollateralError(notTheMinimum);
		} else if (BigInt(collateralAmount) > BigInt(balanceInWallet?.balanceOf || 0n)) {
			const notEnoughBalance = t("common.error.insufficient_balance", {
				symbol: normalizeTokenSymbol(selectedPosition?.collateralSymbol || ""),
			});
			setCollateralError(notEnoughBalance);
		} else if (maxFromLimit > 0n && BigInt(collateralAmount) > maxFromLimit) {
			const maxColl = formatBigInt(maxFromLimit, selectedPosition?.collateralDecimals || 0);
			const availableToMint = formatBigInt(BigInt(selectedPosition.availableForClones), 18);
			const limitExceeded = t("mint.error.global_minting_limit_exceeded", {
				maxCollateral: maxColl,
				collateralSymbol: normalizeTokenSymbol(selectedPosition?.collateralSymbol || ""),
				maxMint: availableToMint,
				mintSymbol: TOKEN_SYMBOL,
			});
			setCollateralError(limitExceeded);
		}
	}, [collateralAmount, balancesByAddress, address, selectedPosition, liquidationPrice]);

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
	// For the native coin (e.g. ETH, cBTC), we check its balance directly; others use the ERC20 balance
	const isNative = selectedCollateral?.symbol === WAGMI_CHAIN.nativeCurrency.symbol;
	const collateralUserBalance = isNative
		? balances.find((b) => b.symbol === WAGMI_CHAIN.nativeCurrency.symbol)
		: balances.find((b) => b.address == selectedCollateral?.address);

	const userBalance = collateralUserBalance?.balanceOf || 0n;
	const selectedBalance = Boolean(selectedCollateral) ? balancesByAddress[selectedCollateral?.address as Address] : null;
	const usdLiquidationPrice = formatCurrency(
		parseFloat(formatUnits(BigInt(liquidationPrice), 36 - (selectedPosition?.collateralDecimals || 0))) * (eurPrice || 0),
		2,
		2
	)?.toString();

	const handleOnSelectedToken = (token: TokenBalance, positionOverride?: PositionQuery) => {
		const position = positionOverride ?? defaultPosition;
		if (!token || !position) return;
		setSelectedCollateral(token);

		const liqPrice = BigInt(position.price);

		setSelectedPosition(position);

		// Calculate max collateral respecting minting limit
		// For ETH, we use the special zero address balance, for others use normal address
		const tokenBalance = balancesByAddress[token.address]?.balanceOf || 0n;
		const maxAmount = getMaxCollateralAmount(tokenBalance, BigInt(position.availableForClones), liqPrice);
		const defaultAmount = maxAmount > BigInt(position.minimumCollateral) ? maxAmount.toString() : position.minimumCollateral;

		setCollateralAmount(defaultAmount);
		setExpirationDate(toDate(position.expiration));
		setLiquidationPrice(liqPrice.toString());

		const loanDetails = getLoanDetailsByCollateralAndStartingLiqPrice(
			position,
			BigInt(maxAmount),
			liqPrice,
			toDate(position.expiration)
		);

		setLoanDetails(loanDetails);
		setBorrowedAmount(loanDetails.amountToSendToWallet.toString());
	};

	const onAmountCollateralChange = (value: string) => {
		setCollateralAmount(value);
		if (!selectedPosition) return;

		const loanDetails = getLoanDetailsByCollateralAndStartingLiqPrice(
			selectedPosition,
			BigInt(value),
			BigInt(liquidationPrice),
			expirationDate || undefined
		);
		setLoanDetails(loanDetails);
		setBorrowedAmount(loanDetails.amountToSendToWallet.toString());
	};

	const onLiquidationPriceChange = (value: string) => {
		setLiquidationPrice(value);

		if (!selectedPosition) return;
		if (!collateralAmount || collateralAmount === "" || collateralAmount === "0") return;

		const loanDetails = getLoanDetailsByCollateralAndStartingLiqPrice(
			selectedPosition,
			BigInt(collateralAmount),
			BigInt(value),
			expirationDate || undefined
		);
		setLoanDetails(loanDetails);
		setBorrowedAmount(loanDetails.amountToSendToWallet.toString());
	};

	const onYouGetChange = (value: string) => {
		setBorrowedAmount(value);

		if (!selectedPosition) return;

		const loanDetails = getLoanDetailsByCollateralAndYouGetAmount(
			selectedPosition,
			BigInt(collateralAmount),
			BigInt(value),
			expirationDate || undefined
		);
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
	}, [expirationDate]);

	const handleMaxExpirationDate = () => {
		if (selectedPosition?.expiration) {
			setExpirationDate(toDate(selectedPosition.expiration));
		}
	};

	const handleMintWithCoin = async () => {
		try {
			if (!selectedPosition || !loanDetails || !expirationDate) return;

			// Validate inputs
			if (BigInt(collateralAmount) <= 0n) {
				toast.error("Collateral amount must be greater than 0");
				return;
			}

			if (userBalance < BigInt(collateralAmount)) {
				toast.error("Insufficient ETH balance");
				return;
			}

			setIsOpenBorrowingDEUROModal(true);
			setIsCloneLoading(true);
			setIsCloneSuccess(false);

			const gatewayAddress = ADDRESS[chainId]?.mintingHubGateway;
			if (!gatewayAddress || gatewayAddress === zeroAddress) {
				toast.error("MintingHubGateway not configured for this network");
				setIsOpenBorrowingDEUROModal(false);
				return;
			}

			const hash = await writeContract(WAGMI_CONFIG, {
				address: gatewayAddress,
				abi: MintingHubGatewayABI,
				functionName: "clone",
				args: [
					address as Address,
					selectedPosition.position as Address,
					BigInt(collateralAmount),
					loanDetails.loanAmount,
					toTimestamp(expirationDate),
					BigInt(liquidationPrice),
					frontendCode,
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
					value: formatBigInt(BigInt(collateralAmount), 18) + " cBTC",
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
							hideTokenSelector={true}
							adornamentRow={
								<div className="self-stretch justify-start items-center inline-flex">
									<div className="grow shrink basis-0 h-4 px-2 justify-start items-center gap-2 flex max-w-full overflow-hidden">
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
						<SelectCollateralModal
							title={t("mint.token_select_modal_title")}
							isOpen={isOpenTokenSelector}
							setIsOpen={setIsOpenTokenSelector}
							options={collateralSelectorOptions}
							onTokenSelect={handleOnSelectedToken}
						/>
						{isMaxedOut && selectedPosition && (
							<div className="self-stretch mt-1 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-md">
								<div className="text-yellow-800 text-sm font-medium">
									⚠️{" "}
									{t("mint.error.position_unavailable_limit_exhausted", {
										available: formatCurrency(formatUnits(BigInt(selectedPosition.availableForClones), 18), 2, 2),
										symbol: TOKEN_SYMBOL,
										minCollateral: formatBigInt(
											BigInt(selectedPosition.minimumCollateral),
											selectedPosition.collateralDecimals
										),
										collateralSymbol: normalizeTokenSymbol(selectedPosition.collateralSymbol),
									})}
								</div>
							</div>
						)}
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
							maxDate={selectedPosition?.expiration ? toDate(selectedPosition?.expiration) : expirationDate}
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
									<span className="text-base leading-tight">{t("mint.original_position")}</span>
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
							<Button className="!p-4 text-lg font-extrabold leading-none" disabled>
								{t("common.receive") + " 0.00 " + TOKEN_SYMBOL}
							</Button>
						) : (
							// Native coin (cBTC) flow via CoinLendingGateway
							<Button
								className="!p-4 text-lg font-extrabold leading-none"
								onClick={handleMintWithCoin}
								disabled={
									!selectedPosition ||
									!selectedCollateral ||
									isLiquidationPriceTooHigh ||
									!!collateralError ||
									isMaxedOut ||
									userBalance < BigInt(collateralAmount)
								}
							>
								{isLiquidationPriceTooHigh
									? t("mint.your_liquidation_price_is_too_high")
									: t("common.receive") +
									  " " +
									  formatCurrency(formatUnits(BigInt(borrowedAmount), 18), 2) +
									  " " +
									  TOKEN_SYMBOL}
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
						formmatedCollateral={`${formatUnits(
							BigInt(collateralAmount),
							selectedPosition?.collateralDecimals || 0
						)} ${normalizeTokenSymbol(selectedPosition?.collateralSymbol || "")}`}
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
