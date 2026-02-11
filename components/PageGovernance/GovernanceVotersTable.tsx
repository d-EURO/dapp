import TableHeader from "../Table/TableHead";
import TableBody from "../Table/TableBody";
import Table from "../Table";
import TableRowEmpty from "../Table/TableRowEmpty";
import { TableShowMoreRow } from "@components/Table/TableShowMoreRow";
import { Address, formatUnits, zeroAddress } from "viem";
import { useEffect, useState } from "react";
import { useNativePSHolders, useVotingPowers, useExpandableTable } from "@hooks";
import GovernanceVotersRow from "./GovernanceVotersRow";

import { useAccount, useChainId } from "wagmi";
import { readContract } from "wagmi/actions";
import { WAGMI_CONFIG } from "../../app.config";
import { mainnet, testnet } from "@config";
import { ADDRESS, EquityABI } from "@juicedollar/jusd";
import { useTranslation } from "next-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons";

export type VoteData = {
	holder: Address;
	nativePS: bigint;
	votingPower: bigint;
	votingPowerRatio: number;
};

export default function GovernanceVotersTable() {
	const { t } = useTranslation();
	const headers: string[] = [t("governance.address"), t("governance.balance"), t("governance.voting_power")];
	const [tab, setTab] = useState<string>(headers[2]);
	const [reverse, setReverse] = useState<boolean>(false);
	const [accountVotes, setAccountVotes] = useState<VoteData>({ nativePS: 0n, holder: zeroAddress, votingPower: 0n, votingPowerRatio: 0 });

	const chainId = useChainId();
	const account = useAccount();
	const nativePoolShareHolders = useNativePSHolders();
	const votingPowersHook = useVotingPowers(nativePoolShareHolders.holders);
	const votesTotal = votingPowersHook.totalVotes;
	const votesData: VoteData[] = votingPowersHook.votesData.map((vp) => {
		const ratio: number = vp.votingPower ? parseInt(vp.votingPower.toString()) / parseInt(votesTotal.toString()) : 0;
		return {
			holder: vp.holder as Address,
			nativePS: BigInt(vp.nativePS),
			votingPower: vp.votingPower as bigint,
			votingPowerRatio: ratio,
		};
	});

	useEffect(() => {
		if (account.address == undefined || !chainId) return;
		const holder = account.address;
		const equityAddress = ADDRESS[chainId]?.equity;

		if (!equityAddress) {
			setAccountVotes({ holder, nativePS: 0n, votingPower: 0n, votingPowerRatio: 0 });
			return;
		}

		(async () => {
			try {
				const [nativePS, votingPowerRatio] = await Promise.all([
					readContract(WAGMI_CONFIG, {
						chainId: chainId as typeof mainnet.id | typeof testnet.id,
						address: equityAddress,
						abi: EquityABI,
						functionName: "balanceOf",
						args: [holder],
					}),
					readContract(WAGMI_CONFIG, {
						chainId: chainId as typeof mainnet.id | typeof testnet.id,
						address: equityAddress,
						abi: EquityABI,
						functionName: "relativeVotes",
						args: [holder],
					}),
				]);
				const votingPower = votingPowerRatio * votesTotal;
				setAccountVotes({ holder, nativePS, votingPower, votingPowerRatio: parseFloat(formatUnits(votingPowerRatio, 18)) });
			} catch {
				setAccountVotes({ holder, nativePS: 0n, votingPower: 0n, votingPowerRatio: 0 });
			}
		})();
	}, [account, votesTotal, chainId]);

	const matchingVotes: VoteData[] = votesData.filter((v) => v.holder.toLowerCase() !== account.address?.toLowerCase());
	const votesDataSorted: VoteData[] = sortVotes({
		votes: matchingVotes,
		account: account.address,
		headers,
		reverse,
		tab,
	});

	const { visibleData, isExpanded, toggleExpanded, showExpandButton } = useExpandableTable(votesDataSorted);

	const handleTabOnChange = function (e: string) {
		if (tab === e) {
			setReverse(!reverse);
		} else {
			setReverse(false);
			setTab(e);
		}
	};

	return (
		<Table>
			<TableHeader
				headers={headers}
				tab={tab}
				reverse={reverse}
				tabOnChange={handleTabOnChange}
				actionCol
				headerClassNames={["text-center"]}
			/>
			<TableBody>
				<>
					{account.address ? (
						<GovernanceVotersRow
							key={account.address}
							headers={headers}
							voter={accountVotes}
							votesTotal={votesTotal}
							connectedWallet
							tab={tab}
						/>
					) : null}
					{votesDataSorted.length == 0 ? (
						<TableRowEmpty>{t("governance.voters_table_empty")}</TableRowEmpty>
					) : (
						visibleData.map((vote) => (
							<GovernanceVotersRow key={vote.holder} headers={headers} voter={vote} votesTotal={votesTotal} tab={tab} />
						))
					)}
					{showExpandButton && (
						<TableShowMoreRow onShowMoreClick={toggleExpanded}>
							<div className="text-table-header-active text-base font-black leading-normal tracking-tight">
								{isExpanded ? t("referrals.show_less") : t("referrals.show_more")}
							</div>
							<div className="justify-start items-center gap-2.5 flex">
								<FontAwesomeIcon icon={isExpanded ? faMinus : faPlus} className="w-4 h-4 text-table-header-active" />
							</div>
						</TableShowMoreRow>
					)}
				</>
			</TableBody>
		</Table>
	);
}

type SortVotes = {
	votes: VoteData[];
	account: Address | undefined;
	headers: string[];
	tab: string;
	reverse: boolean;
};

function sortVotes(params: SortVotes): VoteData[] {
	const { votes, account, headers, tab, reverse } = params;

	if (tab === headers[0]) {
		votes.sort((a, b) => a.holder.localeCompare(b.holder));
	} else if (tab === headers[1]) {
		votes.sort((a, b) => parseInt(b.nativePS.toString()) - parseInt(a.nativePS.toString()));
	} else if (tab === headers[2]) {
		votes.sort((a, b) => b.votingPowerRatio - a.votingPowerRatio);
	}

	const considerReverse = reverse ? votes.reverse() : votes;

	if (!!account) {
		considerReverse.sort((a, b) => (a.holder.toLowerCase() === account.toLowerCase() ? -1 : 1));
	}

	return considerReverse;
}
