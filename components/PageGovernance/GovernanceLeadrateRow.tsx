import { AddressLabelSimple, TxLabelSimple } from "@components/AddressLabel";
import Button from "@components/Button";
import GuardToAllowedChainBtn from "@components/Guards/GuardToAllowedChainBtn";
import GuardToMinVotingPower from "@components/Guards/GuardToMinVotingPower";
import TableRow from "../Table/TableRow";
import { SavingsV3ABI } from "@deuro/eurocoin";
import { useState } from "react";
import { toast } from "react-toastify";
import { waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { Hash, zeroAddress } from "viem";
import { CONFIG_CHAIN, GET_SAVINGS_V3_ADDRESS, WAGMI_CONFIG } from "../../app.config";
import { renderErrorTxToast, TxToast } from "@components/TxToast";
import { ApiLeadrateInfo } from "../../redux/slices/savings.types";
import { LeadrateProposed } from "@deuro/api";
import { formatCurrency } from "../../utils/format";

interface Props {
	headers: string[];
	info: ApiLeadrateInfo;
	proposal: LeadrateProposed;
	currentProposal: boolean;
	tab: string;
}

export default function GovernanceLeadrateRow({ headers, info, proposal, currentProposal, tab }: Props) {
	const isV3 = proposal.source === "v3";
	const versionInfo = isV3 ? info.v3 : info.v2;
	const [isDenying, setDenying] = useState<boolean>(false);
	const [isApplying, setApplying] = useState<boolean>(false);
	const [isHidden, setHidden] = useState<boolean>(false);

	const chainId = CONFIG_CHAIN().id;
	const savingsV3Address = GET_SAVINGS_V3_ADDRESS(chainId);

	const vetoUntil = proposal.nextChange * 1000;
	const hoursUntil: number = (vetoUntil - Date.now()) / 1000 / 60 / 60;
	const stateStr: string = `${Math.round(hoursUntil)} hours left`;

	const dateArr: string[] = new Date(proposal.created * 1000).toDateString().split(" ");
	const dateStr: string = `${dateArr[2]} ${dateArr[1]} ${dateArr[3]}`;

	const handleOnApply = async function (e: any) {
		e.preventDefault();

		try {
			setApplying(true);

			const writeHash = await writeContract(WAGMI_CONFIG, {
				address: savingsV3Address,
				abi: SavingsV3ABI,
				functionName: "applyChange",
				args: [],
			});

			const toastContent = [
				{
					title: `From: `,
					value: `${formatCurrency(versionInfo.rate / 10000)}%`,
				},
				{
					title: `Applying to: `,
					value: `${formatCurrency(proposal.nextRate / 10000)}%`,
				},
				{
					title: "Transaction: ",
					hash: writeHash,
				},
			];

			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: writeHash, confirmations: 1 }), {
				pending: {
					render: <TxToast title={`Applying new rate...`} rows={toastContent} />,
				},
				success: {
					render: <TxToast title="Successfully applied" rows={toastContent} />,
				},
			});

			setHidden(true);
		} catch (error) {
			toast.error(renderErrorTxToast(error));
		} finally {
			setApplying(false);
		}
	};

	const handleOnDeny = async function (e: any) {
		e.preventDefault();

		try {
			setDenying(true);

			const writeHash = await writeContract(WAGMI_CONFIG, {
				address: savingsV3Address,
				abi: SavingsV3ABI,
				functionName: "proposeChange",
				args: [versionInfo.rate, []],
			});

			const toastContent = [
				{
					title: `Current: `,
					value: `${formatCurrency(versionInfo.rate / 10000)}%`,
				},
				{
					title: `Denying: `,
					value: `${formatCurrency(proposal.nextRate / 10000)}%`,
				},
				{
					title: "Transaction: ",
					hash: writeHash,
				},
			];

			await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: writeHash, confirmations: 1 }), {
				pending: {
					render: <TxToast title={`Denying new rate...`} rows={toastContent} />,
				},
				success: {
					render: <TxToast title="Successfully denied" rows={toastContent} />,
				},
			});

			setHidden(true);
		} catch (error) {
			toast.error(renderErrorTxToast(error));
		} finally {
			setDenying(false);
		}
	};

	return (
		<>
			<TableRow
				headers={headers}
				tab={tab}
				actionCol={
					currentProposal && isV3 && savingsV3Address !== zeroAddress ? (
						versionInfo.isPending && versionInfo.isProposal ? (
							<GuardToAllowedChainBtn label="Deny" disabled={!versionInfo.isPending || !versionInfo.isProposal}>
								<GuardToMinVotingPower label="Deny">
									<Button
										className="h-10"
										disabled={!versionInfo.isPending || !versionInfo.isProposal || isHidden}
										isLoading={isDenying}
										onClick={(e) => handleOnDeny(e)}
									>
										Deny
									</Button>
								</GuardToMinVotingPower>
							</GuardToAllowedChainBtn>
						) : (
							<GuardToAllowedChainBtn label="Apply" disabled={!versionInfo.isProposal}>
								<GuardToMinVotingPower label="Apply">
									<Button
										className="h-10"
										disabled={!versionInfo.isProposal || isHidden}
										isLoading={isApplying}
										onClick={(e) => handleOnApply(e)}
									>
										Apply
									</Button>
								</GuardToMinVotingPower>
							</GuardToAllowedChainBtn>
						)
					) : (
						<></>
					)
				}
			>
				<div className="flex flex-col md:text-left max-md:text-right">
					<TxLabelSimple label={dateStr} tx={proposal.txHash as Hash} showLink />
				</div>

				<div className="flex flex-col">
					<AddressLabelSimple address={proposal.proposer} showLink />
				</div>

				<div className={`flex flex-col ${currentProposal && versionInfo.isProposal ? "font-semibold" : ""}`}>
					{proposal.nextRate / 10_000} %
				</div>

				<div className="flex flex-col">
					{currentProposal ? (hoursUntil > 0 ? stateStr : versionInfo.rate != proposal.nextRate ? "Ready" : "Passed") : "Expired"}
				</div>
			</TableRow>
		</>
	);
}
