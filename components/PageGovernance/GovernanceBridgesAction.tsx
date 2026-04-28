import { BridgeStat } from "@hooks";
import { useState } from "react";
import { waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { WAGMI_CONFIG } from "../../app.config";
import { toast } from "react-toastify";
import { shortenAddress } from "@utils";
import { renderErrorTxToast, TxToast } from "@components/TxToast";
import { useAccount } from "wagmi";
import Button from "@components/Button";
import { Address } from "viem";
import GuardToAllowedChainBtn from "@components/Guards/GuardToAllowedChainBtn";
import { StablecoinBridgeABI } from "@deuro/eurocoin";
import { useTranslation } from "next-i18next";

interface Props {
	bridge: BridgeStat;
}

export default function GovernanceBridgesAction({ bridge }: Props) {
	const { t } = useTranslation();
	const [isStopping, setStopping] = useState<boolean>(false);
	const account = useAccount();
	const [isHidden, setHidden] = useState<boolean>(false);

	const handleOnClick = async function (e: any) {
		e.preventDefault();
		if (!account.address) return;

		try {
			setStopping(true);

			const writeHash = await writeContract(WAGMI_CONFIG, {
				address: bridge.bridgeAddress,
				abi: StablecoinBridgeABI,
				functionName: "emergencyStop",
				args: [[] as Address[], "Emergency stop"],
			});

			const toastContent = [
				{
					title: `Bridge: `,
					value: `${bridge.symbol} (${shortenAddress(bridge.bridgeAddress)})`,
				},
				{
					title: "Transaction: ",
					hash: writeHash,
				},
			];

			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: writeHash, confirmations: 1 }), {
				pending: {
					render: <TxToast title={t("governance.emergency_stopping")} rows={toastContent} />,
				},
				success: {
					render: <TxToast title={t("governance.emergency_stopped")} rows={toastContent} />,
				},
			});

			setHidden(true);
		} catch (error) {
			toast.error(renderErrorTxToast(error));
		} finally {
			setStopping(false);
		}
	};

	return (
		<div className="">
			<GuardToAllowedChainBtn label={t("governance.emergency_stop")} disabled={isHidden}>
				<Button className="h-10" disabled={isHidden} isLoading={isStopping} onClick={(e) => handleOnClick(e)}>
					{t("governance.emergency_stop")}
				</Button>
			</GuardToAllowedChainBtn>
		</div>
	);
}
