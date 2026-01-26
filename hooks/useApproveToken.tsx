import { Address, erc20Abi } from "viem";
import { writeContract, waitForTransactionReceipt } from "@wagmi/core";
import { toast } from "react-toastify";
import { WAGMI_CONFIG } from "../app.config";
import { TxToast, TxToastRowType, renderErrorTxToast } from "../components/TxToast";

interface ApproveParams {
	tokenAddress: Address;
	spender: Address;
	amount: bigint;
	t: (key: string) => string;
	onSuccess?: () => void;
}

export const approveToken = async ({ tokenAddress, spender, amount, t, onSuccess }: ApproveParams): Promise<boolean> => {
	try {
		const hash = await writeContract(WAGMI_CONFIG, {
			address: tokenAddress,
			abi: erc20Abi,
			functionName: "approve",
			args: [spender, amount],
		});

		await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash, confirmations: 1 }), {
			pending: { render: <TxToast title={t("common.txs.approving")} rows={[{ title: t("common.txs.transaction"), hash }]} /> },
			success: { render: <TxToast title={t("common.txs.approved")} rows={[{ title: t("common.txs.transaction"), hash }]} /> },
		});

		onSuccess?.();
		return true;
	} catch (error) {
		toast.error(renderErrorTxToast(error));
		return false;
	}
};

interface ExecuteTxParams {
	contractParams: any;
	pendingTitle: string;
	successTitle: string;
	rows?: TxToastRowType[];
}

export const executeTx = async ({ contractParams, pendingTitle, successTitle, rows = [] }: ExecuteTxParams): Promise<`0x${string}`> => {
	const hash = await writeContract(WAGMI_CONFIG, contractParams);
	const toastRows = [...rows, { title: "Transaction", hash }];
	await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash, confirmations: 1 }), {
		pending: { render: <TxToast title={pendingTitle} rows={toastRows} /> },
		success: { render: <TxToast title={successTitle} rows={toastRows} /> },
	});
	return hash;
};
