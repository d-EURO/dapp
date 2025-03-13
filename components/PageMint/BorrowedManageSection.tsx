import { useEffect, useState } from "react";
import TokenLogo from "@components/TokenLogo";
import { NormalInputOutlined } from "@components/Input/NormalInputOutlined";
import Button from "@components/Button";
import { AddCircleOutlineIcon } from "@components/SvgComponents/add_circle_outline";
import { RemoveCircleOutlineIcon } from "@components/SvgComponents/remove_circle_outline";
import { useTranslation } from "next-i18next";
import { useRouter } from "next/router";
import { formatBigInt, formatCurrency, shortenAddress, TOKEN_SYMBOL } from "@utils";
import { useSelector } from "react-redux";
import { RootState } from "../../redux/redux.store";
import { PositionQuery } from "@deuro/api";
import { useWalletERC20Balances } from "../../hooks/useWalletBalances";
import { Address, formatUnits, maxUint256, zeroAddress } from "viem";
import { PositionV2ABI } from "@deuro/eurocoin";
import { erc20Abi } from "viem";
import { useAccount, useChainId } from "wagmi";
import { useReadContracts } from "wagmi";
import { getLoanDetailsByCollateralAndLiqPrice, getLoanDetailsByCollateralAndYouGetAmount } from "../../utils/loanCalculations";
import { renderErrorTxToast } from "@components/TxToast";
import { waitForTransactionReceipt } from "wagmi/actions";
import { WAGMI_CONFIG } from "../../app.config";
import { writeContract } from "wagmi/actions";
import { toast } from "react-toastify";
import { TxToast } from "@components/TxToast";
import { DetailsExpandablePanel } from "@components/DetailsExpandablePanel";

export const BorrowedManageSection = () => {
	const [amount, setAmount] = useState("");
	const [isBorrowMore, setIsBorrowMore] = useState(true);
	const [isTxOnGoing, setIsTxOnGoing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const { address: userAddress } = useAccount();
	const chainId = useChainId();
	const { t } = useTranslation();

	const router = useRouter();
	const { address: addressQuery } = router.query;
	const positions = useSelector((state: RootState) => state.positions.list.list);
	const position = positions.find((p) => p.position == addressQuery) as PositionQuery;

	const { balancesByAddress, refetchBalances } = useWalletERC20Balances([
		{
			symbol: position.deuroSymbol,
			address: position.deuro,
			name: position.deuroName,
			allowance: [position.position],
		},
	]);

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
				abi: PositionV2ABI,
				address: position.position,
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
				functionName: "getInterest",
			},
			{
				chainId,
				abi: PositionV2ABI,
				address: position.position,
				functionName: "getDebt",
			},
		],
	});

	if (!position) return null;

	const { reserveContribution } = position;

	const principal = data?.[0]?.result || BigInt(position.principal);
	const price = data?.[1]?.result || BigInt(position.price);
	const balanceOf = data?.[2]?.result || BigInt(position.collateralBalance);
	const interest = data?.[3]?.result || 0n;
	const totalDebt = data?.[4]?.result || 0n;
	const amountBorrowed = BigInt(principal) - (BigInt(principal) * BigInt(reserveContribution)) / 1_000_000n;
	const debt = amountBorrowed + interest;
	const walletBalance = balancesByAddress?.[position.deuro as Address]?.balanceOf || 0n;
	const allowance = balancesByAddress?.[position.deuro as Address]?.allowance?.[position.position] || 0n;

	const { amountToSendToWallet: maxAmountByDepositedCollateral } = getLoanDetailsByCollateralAndLiqPrice(position, balanceOf, price);
	const maxBeforeAddingMoreCollateral = maxAmountByDepositedCollateral - totalDebt > 0 ? maxAmountByDepositedCollateral - totalDebt : 0n;

	const handleMaxAmount = () => {
		if(isBorrowMore) {
			setAmount(maxBeforeAddingMoreCollateral.toString());
		} else {
			setAmount(debt.toString());
		}
	}

	const handleBorrowMore = async () => {
		try {
			setIsTxOnGoing(true);

			const { loanAmount } = getLoanDetailsByCollateralAndYouGetAmount(position, balanceOf, BigInt(amount));

			const borrowMoreHash = await writeContract(WAGMI_CONFIG, {
				address: position.position,
				abi: PositionV2ABI,
				functionName: "mint",
				args: [userAddress as Address, loanAmount],
			});

			const toastContent = [
				{
					title: t("common.txs.amount"),
					value: formatBigInt(BigInt(amount)) + ` ${position.deuroSymbol}`,
				},
				{
					title: t("common.txs.transaction"),
					hash: borrowMoreHash,
				},
			];

			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: borrowMoreHash, confirmations: 1 }), {
				pending: {
					render: <TxToast title={t("mint.txs.minting", { symbol: position.deuroSymbol })} rows={toastContent} />,
				},
				success: {
					render: <TxToast title={t("mint.txs.minting_success", { symbol: position.deuroSymbol })} rows={toastContent} />,
				},
			});
			setAmount("");
			refetchBalances();
			refetchReadContracts();
		} catch (error) {
			toast.error(renderErrorTxToast(error));
		} finally {
			setIsTxOnGoing(false);
		}
	};


	const handleApprove = async () => {
		try {
			setIsTxOnGoing(true);

			const approveWriteHash = await writeContract(WAGMI_CONFIG, {
				address: position.deuro as Address,
				abi: erc20Abi,
				functionName: "approve",
				args: [position.position, maxUint256],
			});

			const toastContent = [
				{
					title: t("common.txs.amount"),
					value: "infinite " + position.deuroSymbol,
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
					render: <TxToast title={`${t("common.txs.title", { symbol: position.deuroSymbol })}`} rows={toastContent} />,
				},
				success: {
					render: <TxToast title={`${t("common.txs.success", { symbol: position.deuroSymbol })}`} rows={toastContent} />,
				},
			});
			refetchBalances();
			refetchReadContracts();
			setAmount("");
		} catch (error) {
			toast.error(renderErrorTxToast(error)); // TODO: needs to be translated
		} finally {
			setIsTxOnGoing(false);
		}
	};

	const handlePayBack = async () => {
		try {
			setIsTxOnGoing(true);

			let payBackHash: `0x${string}` = zeroAddress as `0x${string}`;

			if(amount.toString() === debt.toString()) {
				payBackHash = await writeContract(WAGMI_CONFIG, {
					address: position.position,
					abi: PositionV2ABI,
					functionName: "repayFull",
				});
			} else {
				const { loanAmount } = getLoanDetailsByCollateralAndYouGetAmount(position, balanceOf, BigInt(amount));
				payBackHash = await writeContract(WAGMI_CONFIG, {
					address: position.position,
					abi: PositionV2ABI,
					functionName: "repay",
					args: [loanAmount],
				});
			}

			const toastContent = [
				{
					title: t("common.txs.amount"),
					value: formatBigInt(BigInt(amount)) + ` ${position.deuroSymbol}`,
				},
				{
					title: t("common.txs.transaction"),
					hash: payBackHash,
				},
			];

			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: payBackHash, confirmations: 1 }), {
				pending: {
					render: <TxToast title={t("mint.txs.pay_back", { symbol: position.deuroSymbol })} rows={toastContent} />,
				},
				success: {
					render: <TxToast title={t("mint.txs.pay_back_success", { symbol: position.deuroSymbol })} rows={toastContent} />,
				},
			});
			setAmount("");
			refetchBalances();
			refetchReadContracts();
		} catch (error) {
			toast.error(renderErrorTxToast(error));
		} finally {
			setIsTxOnGoing(false);
		}
	};

	// Error validation for Borrow More
	useEffect(() => {
		if(!isBorrowMore) return;

		if(!amount) {
			setError(null);
		} else if(BigInt(amount) > maxBeforeAddingMoreCollateral) {
			setError(t("mint.error.minting_limit_exceeded", { amount: formatCurrency(formatUnits(maxBeforeAddingMoreCollateral, 18)), symbol: position.deuroSymbol }));
		} else {
			setError(null);
		}
	}, [isBorrowMore, amount, maxBeforeAddingMoreCollateral]);

	// Error validation for Pay Back
	useEffect(() => {
		if(isBorrowMore) return;

		if(!amount) {
			setError(null);
		} else if (BigInt(amount) > walletBalance) {
			setError(t("common.error.insufficient_balance", { symbol: position.deuroSymbol }));
		} else if(BigInt(amount) > debt) {
			setError(t("mint.error.amount_greater_than_debt", { amount: formatCurrency(formatUnits(debt, 18)), symbol: position.deuroSymbol }));
		} else {
			setError(null);
		}
	}, [isBorrowMore, amount, debt, walletBalance]);

	return (
		<div className="flex flex-col gap-y-8">
			<div className="flex flex-col gap-y-3">
				<div className="flex flex-row justify-between items-center">
					<div className="pl-3 flex flex-row gap-x-2 items-center">
						<TokenLogo currency={TOKEN_SYMBOL} />
						<div className="flex flex-col">
							<span className="text-base font-extrabold leading-tight">
								<span className="">{formatCurrency(formatUnits(debt, 18))}</span> {TOKEN_SYMBOL}
							</span>
							<span className="text-xs font-medium text-text-muted2 leading-[1rem]"></span>
						</div>
					</div>
					<div className="flex flex-col sm:flex-row justify-end items-start sm:items-center">
						<button className="px-2 flex flex-row gap-x-1 items-center py-1" onClick={() => setIsBorrowMore(true)}>
							<AddCircleOutlineIcon color={isBorrowMore ? "#065DC1" : "#8B92A8"} />
							<span
								className={`mt-0.5 ${
									isBorrowMore ? "text-button-textGroup-primary-text" : "text-button-textGroup-secondary-text"
								} text-base font-extrabold leading-tight`}
							>
								{t("mint.borrow_more")}
							</span>
						</button>
						<button className="px-2 flex flex-row gap-x-1 items-center py-1" onClick={() => setIsBorrowMore(false)}>
							<RemoveCircleOutlineIcon color={isBorrowMore ? "#8B92A8" : "#065DC1"} />
							<span
								className={`mt-0.5 ${
									isBorrowMore ? "text-button-textGroup-secondary-text" : "text-button-textGroup-primary-text"
								} text-base font-extrabold leading-tight`}
							>
								{t("mint.pay_back")}
							</span>
						</button>
					</div>
				</div>
				<div className="w-full">
					<NormalInputOutlined
						showTokenLogo={false}
						value={amount}
						onChange={setAmount}
						decimals={18}
						unit={TOKEN_SYMBOL}
						isError={Boolean(error)}
						adornamentRow={
							<div className="pl-2 text-xs leading-[1rem] flex flex-row gap-x-2">
								<span className="font-medium text-text-muted3">
									{t(isBorrowMore ? "mint.available_to_borrow" : "mint.pay_back_amount")}:
								</span>
								<button className="text-text-labelButton font-extrabold" onClick={handleMaxAmount}>
									{formatCurrency(formatUnits(isBorrowMore ? maxBeforeAddingMoreCollateral : debt, 18))} {TOKEN_SYMBOL}
								</button>
							</div>
						}
					/>
					{error && <div className="ml-1 text-text-warning text-sm">{error}</div>}
				</div>
				<div className="w-full mt-1.5 px-4 py-2 rounded-xl bg-[#E4F0FC] flex flex-row justify-between items-center text-base font-extrabold text-[#272B38]">
					<span>{t("mint.collateralization")}</span>
					<span>100%</span>
				</div>
			</div>
			{allowance < BigInt(amount) && !isBorrowMore ? (
				<Button className="text-lg leading-snug !font-extrabold" onClick={handleApprove} isLoading={isTxOnGoing} disabled={isTxOnGoing}>
					{t("common.approve")}
				</Button>
			) : (
				<Button
					className="text-lg leading-snug !font-extrabold"
					onClick={isBorrowMore ? handleBorrowMore : handlePayBack}
					isLoading={isTxOnGoing}
					disabled={!amount}
				>
					{t(isBorrowMore ? "mint.borrow_more" : "mint.pay_back")}
				</Button>
			)}
			<DetailsExpandablePanel loanDetails={undefined} collateralPriceDeuro={0} />
		</div>
	);
};
