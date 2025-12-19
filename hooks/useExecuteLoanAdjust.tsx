import { Address } from "viem";
import { toast } from "react-toastify";
import { PositionV2ABI } from "@juicedollar/jusd";
import { PositionQuery } from "@juicedollar/api";
import { formatPositionValue, formatPositionDelta, normalizeTokenSymbol } from "@utils";
import { renderErrorTxToast } from "../components/TxToast";
import { fetchPositionsList } from "../redux/slices/positions.slice";
import { store } from "../redux/redux.store";
import { executeTx } from "./useApproveToken";
import { SolverOutcome } from "../utils/positionSolver";

interface ExecuteLoanAdjustParams {
	outcome: SolverOutcome;
	position: PositionQuery;
	userAddress: Address;
	principal: bigint;
	collateralBalance: bigint;
	isNativeWrappedPosition: boolean;
	t: (key: string, params?: Record<string, string>) => string;
	onSuccess: () => void;
}

export const executeLoanAdjust = async ({
	outcome,
	position,
	userAddress,
	principal,
	collateralBalance,
	isNativeWrappedPosition,
	t,
	onSuccess,
}: ExecuteLoanAdjustParams): Promise<void> => {
	const posAddr = position.position as Address;

	if (outcome.next.debt === 0n && principal > 0n) {
		await executeTx({
			contractParams: { address: posAddr, abi: PositionV2ABI, functionName: "repayFull", args: [] },
			pendingTitle: t("mint.txs.pay_back", { symbol: position.stablecoinSymbol }),
			successTitle: t("mint.txs.pay_back_success", { symbol: position.stablecoinSymbol }),
		});

		if (outcome.next.collateral === 0n && collateralBalance > 0n) {
			await executeTx({
				contractParams: {
					address: posAddr,
					abi: PositionV2ABI,
					functionName: isNativeWrappedPosition ? "withdrawCollateralAsNative" : "withdrawCollateral",
					args: [userAddress, collateralBalance],
				},
				pendingTitle: t("mint.txs.removing_collateral"),
				successTitle: t("mint.txs.removing_collateral_success"),
			});
		}
	} else {
		const depositAmount = outcome.deltaCollateral > 0n ? outcome.deltaCollateral : 0n;
		const isWithdrawing = outcome.deltaCollateral < 0n;
		const newPrincipal = outcome.next.debt === 0n ? 0n : principal + outcome.deltaDebt;
		const finalLiqPrice = outcome.deltaLiqPrice === 0n ? BigInt(position.price) : outcome.next.liqPrice;
		const needsPriceAdjustFirst = outcome.deltaLiqPrice > 0n && outcome.deltaDebt > 0n;

		if (needsPriceAdjustFirst) {
			await executeTx({
				contractParams: {
					address: posAddr,
					abi: PositionV2ABI,
					functionName: "adjustPrice",
					args: [finalLiqPrice],
				},
				pendingTitle: t("mint.txs.adjusting_price"),
				successTitle: t("mint.txs.adjusting_price_success"),
				rows: [
					{
						title: t("mint.adjust_price"),
						value: formatPositionDelta(outcome.deltaLiqPrice, 36 - position.collateralDecimals, "JUSD"),
					},
				],
			});
			store.dispatch(fetchPositionsList());
			onSuccess();
			return;
		}

		const rows = [
			outcome.deltaCollateral !== 0n && {
				title: outcome.deltaCollateral > 0n ? t("mint.deposit_collateral") : t("mint.withdraw_collateral"),
				value: formatPositionValue(
					outcome.deltaCollateral > 0n ? outcome.deltaCollateral : -outcome.deltaCollateral,
					position.collateralDecimals,
					normalizeTokenSymbol(position.collateralSymbol)
				),
			},
			outcome.deltaDebt !== 0n && {
				title: outcome.deltaDebt > 0n ? t("mint.borrow_more") : t("mint.repay"),
				value: formatPositionValue(outcome.deltaDebt > 0n ? outcome.deltaDebt : -outcome.deltaDebt, 18, position.stablecoinSymbol),
			},
			outcome.deltaLiqPrice !== 0n && {
				title: t("mint.adjust_price"),
				value: formatPositionDelta(outcome.deltaLiqPrice, 36 - position.collateralDecimals, "JUSD"),
			},
		].filter(Boolean) as { title: string; value: string }[];

		const txTitle =
			outcome.deltaDebt < 0n
				? `${t("mint.repay")} ${formatPositionValue(-outcome.deltaDebt, 18, position.stablecoinSymbol)}`
				: outcome.deltaDebt > 0n
				? `${t("mint.lending")} ${formatPositionValue(outcome.deltaDebt, 18, position.stablecoinSymbol)}`
				: t("mint.adjust_position");

		await executeTx({
			contractParams: {
				address: posAddr,
				abi: PositionV2ABI,
				functionName: "adjust",
				args: [newPrincipal, outcome.next.collateral, finalLiqPrice, isWithdrawing && isNativeWrappedPosition],
				value: isNativeWrappedPosition && depositAmount > 0n ? depositAmount : undefined,
			},
			pendingTitle: txTitle,
			successTitle: txTitle,
			rows,
		});
	}

	store.dispatch(fetchPositionsList());
	onSuccess();
};

export const handleLoanExecute = async (params: ExecuteLoanAdjustParams & { setIsTxOnGoing: (v: boolean) => void }): Promise<void> => {
	const { setIsTxOnGoing, ...executeParams } = params;
	try {
		setIsTxOnGoing(true);
		await executeLoanAdjust(executeParams);
	} catch (error) {
		toast.error(renderErrorTxToast(error));
	} finally {
		setIsTxOnGoing(false);
	}
};
