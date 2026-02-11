import { Address } from "viem";
import { toast } from "react-toastify";
import { PositionV2ABI } from "@juicedollar/jusd";
import { PositionQuery } from "@juicedollar/api";
import { formatPositionValue, normalizeTokenSymbol } from "@utils";
import { renderErrorTxToast } from "../components/TxToast";
import { fetchPositionsList } from "../redux/slices/positions.slice";
import { store } from "../redux/redux.store";
import { mainnet, testnet } from "@config";
import { executeTx } from "./useApproveToken";
import { SolverOutcome } from "../utils/positionSolver";

interface ExecuteLoanAdjustParams {
	chainId: number;
	outcome: SolverOutcome;
	position: PositionQuery;
	principal: bigint;
	isNativeWrappedPosition: boolean;
	t: (key: string, params?: Record<string, string>) => string;
	onSuccess: () => void;
}

export const executeLoanAdjust = async ({
	chainId,
	outcome,
	position,
	principal,
	isNativeWrappedPosition,
	t,
	onSuccess,
}: ExecuteLoanAdjustParams): Promise<void> => {
	const posAddr = position.position as Address;
	const depositAmount = outcome.deltaCollateral > 0n ? outcome.deltaCollateral : 0n;
	const isWithdrawing = outcome.deltaCollateral < 0n;
	const LiqPrice = BigInt(position.price);

	// Contract: repay branch executes when newPrincipal < principal
	const isFullClose = outcome.next.debt === 0n && principal > 0n;

	// Case 3: repay ≤ interest → need separate repay() call first
	const needsSeparateRepay = !isFullClose && outcome.deltaDebt < 0n && outcome.next.debt >= principal;

	const newPrincipal = isFullClose
		? 0n // Case 1: close position
		: outcome.deltaDebt >= 0n
		? principal + outcome.deltaDebt // Borrow
		: outcome.next.debt < principal
		? outcome.next.debt // Case 2: repay > interest
		: principal; // Case 3 & 4: no principal change in adjust()

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
	].filter(Boolean) as { title: string; value: string }[];

	const txTitle = isFullClose
		? t("mint.close_position")
		: outcome.deltaDebt < 0n
		? `${t("mint.repay")} ${formatPositionValue(-outcome.deltaDebt, 18, position.stablecoinSymbol)}`
		: outcome.deltaDebt > 0n
		? `${t("mint.lending")} ${formatPositionValue(outcome.deltaDebt, 18, position.stablecoinSymbol)}`
		: t("mint.adjust_position");

	// Case 3: call repay() first
	if (needsSeparateRepay) {
		await executeTx({
			chainId: chainId as typeof mainnet.id | typeof testnet.id,
			contractParams: {
				address: posAddr,
				abi: PositionV2ABI,
				functionName: "repay",
				args: [-outcome.deltaDebt],
			},
			pendingTitle: t("mint.txs.pay_back", { symbol: position.stablecoinSymbol }),
			successTitle: t("mint.txs.pay_back_success", { symbol: position.stablecoinSymbol }),
			rows: [{ title: t("common.txs.amount"), value: formatPositionValue(-outcome.deltaDebt, 18, position.stablecoinSymbol) }],
		});
	}

	await executeTx({
		chainId: chainId as typeof mainnet.id | typeof testnet.id,
		contractParams: {
			address: posAddr,
			abi: PositionV2ABI,
			functionName: "adjust",
			args: [newPrincipal, outcome.next.collateral, LiqPrice, isWithdrawing && isNativeWrappedPosition],
			value: isNativeWrappedPosition && depositAmount > 0n ? depositAmount : undefined,
		},
		pendingTitle: txTitle,
		successTitle: txTitle,
		rows,
	});

	store.dispatch(fetchPositionsList(chainId));
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
