import { Dispatch, SetStateAction, useState } from "react";
import { waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { WAGMI_CONFIG } from "../../app.config";
import { toast } from "react-toastify";
import { formatCurrency, TOKEN_SYMBOL } from "@utils";
import { renderErrorTxToast, TxToast } from "@components/TxToast";
import { useAccount, useChainId } from "wagmi";
import Button from "@components/Button";
import { formatUnits } from "viem";
import { ADDRESS, SavingsGatewayABI } from "@deuro/eurocoin";
import { useFrontendCode } from "../../hooks/useFrontendCode";
import { useTranslation } from "next-i18next";
interface Props {
	amount: bigint;
	interest: bigint;
	disabled?: boolean;
	setLoaded?: (val: boolean) => Dispatch<SetStateAction<boolean>>;
}

export default function SavingsActionSave({ amount, interest, disabled, setLoaded }: Props) {
	const [isAction, setAction] = useState<boolean>(false);
	const [isHidden, setHidden] = useState<boolean>(false);
	const { frontendCode } = useFrontendCode();
	const account = useAccount();
	const chainId = useChainId();
	const { t } = useTranslation();

	const handleOnClick = async function (e: any) {
		e.preventDefault();
		if (!account.address) return;

		try {
			setAction(true);

			const writeHash = await writeContract(WAGMI_CONFIG, {
				address: ADDRESS[chainId].savingsGateway,
				abi: SavingsGatewayABI,
				functionName: "adjust",
				args: [amount, frontendCode],
			});

			const toastContent = [
				{
					title: `${t("savings.txs.saving_amount")}`,
					value: `${formatCurrency(formatUnits(amount, 18))} ${TOKEN_SYMBOL}`,
				},
				{
					title: `${t("savings.txs.accured_interest")}`,
					value: `${formatCurrency(formatUnits(interest, 18))} ${TOKEN_SYMBOL}`,
				},
				{
					title: `${t("common.txs.transaction")}`,
					hash: writeHash,
				},
			];

			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: writeHash, confirmations: 1 }), {
				pending: {
					render: <TxToast title={t("savings.txs.increasing_savings")} rows={toastContent} />,
				},
				success: {
					render: <TxToast title={t("savings.txs.successfully_increased_savings")} rows={toastContent} />,
				},
			});

			setHidden(true);
		} catch (error) {
			toast.error(renderErrorTxToast(error));
		} finally {
			if (setLoaded != undefined) setLoaded(false);
			setAction(false);
		}
	};

	return (
		<Button className="h-10" disabled={isHidden || disabled} isLoading={isAction} onClick={(e) => handleOnClick(e)}>
			{t("savings.save")}
		</Button>
	);
}
