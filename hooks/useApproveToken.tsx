import { Address, erc20Abi } from "viem";
import { waitForTransactionReceipt } from "@wagmi/core";
import { toast } from "react-toastify";
import { WAGMI_CONFIG } from "../app.config";
import { TxToast, TxToastRowType, renderErrorTxToast } from "../components/TxToast";
import { simulateAndWrite } from "../utils/contractHelpers";
import { mainnet, testnet } from "@config";

interface ApproveParams {
	tokenAddress: Address;
	spender: Address;
	amount: bigint;
	chainId: typeof mainnet.id | typeof testnet.id;
	t: (key: string) => string;
	onSuccess?: () => void;
}

export const approveToken = async ({ tokenAddress, spender, amount, chainId, t, onSuccess }: ApproveParams): Promise<boolean> => {
	try {
		const hash = await simulateAndWrite({
			chainId: chainId as typeof mainnet.id | typeof testnet.id,
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
	chainId: typeof mainnet.id | typeof testnet.id;
	contractParams: any;
	pendingTitle: string;
	successTitle: string;
	rows?: TxToastRowType[];
}

export const executeTx = async ({
	chainId,
	contractParams,
	pendingTitle,
	successTitle,
	rows = [],
}: ExecuteTxParams): Promise<`0x${string}`> => {
	const hash = await simulateAndWrite({
		chainId,
		...contractParams,
	});
	const toastRows = [...rows, { title: "Transaction", hash }];
	await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash, confirmations: 1 }), {
		pending: { render: <TxToast title={pendingTitle} rows={toastRows} /> },
		success: { render: <TxToast title={successTitle} rows={toastRows} /> },
	});
	return hash;
};
