import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import AppBox from "@components/AppBox";
import TokenInput from "@components/Input/TokenInput";
import DisplayAmount from "@components/DisplayAmount";
import { Address, erc20Abi, formatUnits, maxUint256, zeroAddress } from "viem";
import { ContractUrl, formatBigInt, formatCurrency, formatDate, shortenAddress, TOKEN_SYMBOL } from "@utils";
import Link from "next/link";
import Button from "@components/Button";
import { useAccount, useBlockNumber, useChainId } from "wagmi";
import { readContract, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { toast } from "react-toastify";
import { TxToast, renderErrorTxToast } from "@components/TxToast";
import DisplayLabel from "@components/DisplayLabel";
import GuardToAllowedChainBtn from "@components/Guards/GuardToAllowedChainBtn";
import { WAGMI_CHAIN, WAGMI_CONFIG } from "../../../app.config";
import { RootState } from "../../../redux/redux.store";
import { useSelector } from "react-redux";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
import { useRouter as useNavigation } from "next/navigation";
import { ADDRESS, DecentralizedEUROABI, MintingHubV2ABI } from "@deuro/eurocoin";
import { ChallengesId } from "@deuro/api";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";

export default function ChallengePlaceBid() {
	const [isInit, setInit] = useState(false);
	const [amount, setAmount] = useState(0n);
	const [error, setError] = useState("");
	const [isApproving, setIsApproving] = useState(false);
	const [isBidding, setBidding] = useState(false);
	const [isNavigating, setNavigating] = useState(false);
	const [userBalance, setUserBalance] = useState(0n);
	const [userAllowance, setUserAllowance] = useState(0n);
	const [auctionPrice, setAuctionPrice] = useState<bigint>(0n);

	const { data } = useBlockNumber({ watch: true });
	const account = useAccount();
	const router = useRouter();
	const navigate = useNavigation();

	const chainId = useChainId();
	const challengeId: ChallengesId = (String(router.query.index) as ChallengesId) || `${zeroAddress}-challenge-0`;

	const challenges = useSelector((state: RootState) => state.challenges.list.list);
	const positions = useSelector((state: RootState) => state.positions.list.list);

	const { t } = useTranslation();

	const challenge = challenges.find((c) => c.id == challengeId);
	const position = positions.find((p) => p.position == challenge?.position);

	useEffect(() => {
		const acc: Address | undefined = account.address;
		const ADDR = ADDRESS[WAGMI_CHAIN.id];
		if (position === undefined) return;
		if (challenge === undefined) return;

		const fetchAsync = async function () {
			if (acc !== undefined) {
				const _balance = await readContract(WAGMI_CONFIG, {
					address: ADDR.decentralizedEURO,
					abi: DecentralizedEUROABI,
					functionName: "balanceOf",
					args: [acc],
				});
				setUserBalance(_balance);

				const _allowance = await readContract(WAGMI_CONFIG, {
					address: ADDR.decentralizedEURO,
					abi: erc20Abi,
					functionName: "allowance",
					args: [acc, ADDR.mintingHubGateway],
				});
				setUserAllowance(_allowance);
			}

			const _price = await readContract(WAGMI_CONFIG, {
				address: ADDR.mintingHubGateway,
				abi: MintingHubV2ABI,
				functionName: "price",
				args: [parseInt(challenge.number.toString())],
			});
			setAuctionPrice(_price);
		};

		fetchAsync();
	}, [data, position, challenge, account.address]);

	useEffect(() => {
		if (isInit) return;
		if (challenge === undefined) return;

		const _amount = BigInt(parseInt(challenge.size.toString()) - parseInt(challenge.filledSize.toString()));
		setAmount(_amount);

		setInit(true);
	}, [isInit, challenge]);

	useEffect(() => {
		if (isNavigating && position?.position) {
			navigate.push(`/mypositions`);
		}
	}, [isNavigating, navigate, position]);

	if (!challenge) return null;
	if (!position) return null;

	const remainingSize = BigInt(parseInt(challenge.size.toString()) - parseInt(challenge.filledSize.toString()));

	const start: number = parseInt(challenge.start.toString()) * 1000; // timestamp
	const duration: number = parseInt(challenge.duration.toString()) * 1000;

	const timeToExpiration = start >= position.expiration * 1000 ? 0 : position.expiration * 1000 - start;
	const phase1 = Math.min(timeToExpiration, duration);

	const declineStartTimestamp = start + phase1;
	const zeroPriceTimestamp = start + phase1 + duration;

	const expectedDEURO = (bidAmount?: bigint) => {
		if (!bidAmount) bidAmount = amount;
		return challenge ? (bidAmount * auctionPrice) / BigInt(1e18) : BigInt(0);
	};

	const onChangeAmount = (value: string) => {
		const valueBigInt = BigInt(value);
		setAmount(valueBigInt);

		const expectedAmount = expectedDEURO(valueBigInt);
		
		if (expectedAmount > userBalance) {
			setError(t("challenges.error.not_enough_deuro", { symbol: TOKEN_SYMBOL }));
		} else if (valueBigInt > remainingSize) {
			setError(t("challenges.error.expected_winning_collateral"));
		} else {
			setError("");
		}
	};

	const handleApprove = async () => {
		try {
			setIsApproving(true);

			const approveWriteHash = await writeContract(WAGMI_CONFIG, {
				address: ADDRESS[chainId].decentralizedEURO,
				abi: erc20Abi,
				functionName: "approve",
				args: [ADDRESS[chainId].mintingHubGateway, maxUint256],
			});

			const toastContent = [
				{
					title: t("common.txs.amount"),
					value: "infinite " + TOKEN_SYMBOL,
				},
				{
					title: t("common.txs.spender"),
					value: shortenAddress(ADDRESS[chainId].mintingHubGateway),
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
			setUserAllowance(maxUint256);
		} catch (error) {
			toast.error(renderErrorTxToast(error));
		} finally {
			setIsApproving(false);
		}
	};

	const handleBid = async () => {
		try {
			setBidding(true);

			const bidWriteHash = await writeContract(WAGMI_CONFIG, {
				address: ADDRESS[chainId].mintingHubGateway,
				abi: MintingHubV2ABI,
				functionName: "bid",
				args: [parseInt(challenge.number.toString()), amount, false],
			});

			const toastContent = [
				{
					title: t("challenges.txs.bid_amount"),
					value: formatBigInt(amount, position.collateralDecimals) + " " + position.collateralSymbol,
				},
				{
					title: t("challenges.txs.expected", { symbol: TOKEN_SYMBOL }),
					value: formatCurrency(formatUnits(expectedDEURO(), 18)) + " " + TOKEN_SYMBOL,
				},
				{
					title: t("common.txs.transaction"),
					hash: bidWriteHash,
				},
			];

			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: bidWriteHash, confirmations: 1 }), {
				pending: {
					render: <TxToast title={t("challenges.txs.placing_bid")} rows={toastContent} />,
				},
				success: {
					render: <TxToast title={t("challenges.txs.successfully_placed_bid")} rows={toastContent} />,
				},
			});
			setNavigating(true);
		} catch (error) {
			toast.error(renderErrorTxToast(error)); 
		} finally {
			setBidding(false);
		}
	};

	return (
		<>
			<Head>
				<title>dEURO - {t("challenges.bid")}</title>
			</Head>

			<div className="md:mt-8">
				<section className="mx-auto max-w-2xl sm:px-8">
					<div className="bg-card-body-primary shadow-card rounded-xl p-4 flex flex-col gap-y-4">
						<div className="text-lg font-bold text-center mt-3">{t("challenges.buy_collateral", { symbol: position.collateralSymbol })}</div>

						<div className="">
							<TokenInput
								label=""
								max={remainingSize}
								value={amount.toString()}
								onChange={onChangeAmount}
								digit={position.collateralDecimals}
								symbol={position.collateralSymbol}
								error={error}
								placeholder={t("common.collateral_amount")}
								balanceLabel={t("common.available_label")}
							/>
							<div className="flex flex-col">
								<span>{t("common.your_balance")} {formatCurrency(formatUnits(userBalance, 18), 2, 2)} {TOKEN_SYMBOL}</span>
							</div>
							<div className="flex flex-col">
								<span>{t("common.estimated_cost")} {formatCurrency(formatUnits(expectedDEURO(), 18), 2, 2)} {TOKEN_SYMBOL}</span>
							</div>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-2 lg:col-span-2">
							<AppBox>
								<DisplayLabel label={t("common.available")} />
								<DisplayAmount
									amount={remainingSize}
									currency={position.collateralSymbol}
									address={position.collateral}
									digits={position.collateralDecimals}
									className="mt-4"
								/>
							</AppBox>
							<AppBox>
								<DisplayLabel label={t("common.price_per_unit")} />
								<DisplayAmount
									amount={auctionPrice}
									digits={36 - position.collateralDecimals}
									address={ADDRESS[chainId].decentralizedEURO}
									currency={TOKEN_SYMBOL}
									className="mt-4"
								/>
							</AppBox>
							<AppBox>
								<DisplayLabel label={t("challenges.initially_available")} />
								<DisplayAmount
									amount={challenge.size || 0n}
									currency={position.collateralSymbol}
									address={position.collateral}
									digits={position.collateralDecimals}
									className="mt-4"
								/>
							</AppBox>
							<AppBox>
								<DisplayLabel label={t("challenges.challenger")} />
								<Link
									className="text-link"
									href={ContractUrl(challenge?.challenger || zeroAddress, WAGMI_CHAIN)}
									target="_blank"
									rel="noreferrer"
								>
									<div className="mt-4">
										{shortenAddress(challenge?.challenger || zeroAddress)}
										<FontAwesomeIcon icon={faArrowUpRightFromSquare} className="w-3 ml-2" />
									</div>
								</Link>
							</AppBox>
							<AppBox>
								<DisplayLabel label={t("challenges.fixed_price_until")} />
								<div>{formatDate(declineStartTimestamp / 1000) || "---"}</div>
							</AppBox>
							<AppBox>
								<DisplayLabel label={t("challenges.reaching_zero_at")} />
								{formatDate(zeroPriceTimestamp / 1000) || "---"}
							</AppBox>
						</div>
						<div className="mx-auto mt-4 w-72 max-w-full flex-col">
							<GuardToAllowedChainBtn label={userAllowance < expectedDEURO() ? t("common.approve") : t("common.buy")}>
								{userAllowance < expectedDEURO() ? (
									<Button
										disabled={amount == 0n || error != ""}
										isLoading={isApproving}
										onClick={() => handleApprove()}
									>
										{t("common.approve")}
									</Button>
								) : (
									<Button
										disabled={amount == 0n || expectedDEURO() > userBalance || error != ""}
										isLoading={isBidding}
										onClick={() => handleBid()}
									>
										{t("common.buy")}
									</Button>
								)}
							</GuardToAllowedChainBtn>
						</div>
					</div>
				</section>
			</div>
		</>
	);
}

export async function getServerSideProps({ locale }: { locale: string }) {
	return {
		props: {
			...(await serverSideTranslations(locale, ["common"])),
		},
	};
}