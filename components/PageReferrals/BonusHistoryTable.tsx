import { formatCurrency, shortenHash, TxUrl } from "@utils";
import Table from "../Table";
import TableBody from "../Table/TableBody";
import TableHeader from "../Table/TableHead";
import TableRow from "../Table/TableRow";
import TableRowEmpty from "../Table/TableRowEmpty";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUpRightFromSquare, faMinus, faPlus } from "@fortawesome/free-solid-svg-icons";
import { useState } from "react";
import { TableShowMoreRow } from "@components/Table/TableShowMoreRow";
import { SectionTitle } from "@components/SectionTitle";
import { useTranslation } from "next-i18next";
import { useSelector } from "react-redux";
import { RootState } from "../../redux/redux.store";
import { gql, useQuery } from "@apollo/client";
import { formatUnits } from "viem";
import { useExpandableTable } from "@hooks";

interface BonusData {
	payout: string;
	source: string;
	date: string;
	txId: string;
}

const subHeaders = ["JUSD", "", "", ""];

export default function BonusHistoryTable() {
	const { t } = useTranslation();
	const headers = [t("referrals.payout"), t("referrals.source"), t("referrals.date"), t("referrals.tx_id")];
	const [tab, setTab] = useState<string>(headers[0]);
	const [reverse, setReverse] = useState<boolean>(false);

	const myFrontendCode = useSelector((state: RootState) => state.myReferrals.myFrontendCode);

	const { data: bonusData } = useQuery(
		gql`
			query {
				frontendBonusHistoryMappings(
					where: { frontendCode: "${myFrontendCode}" }
					limit: 10
				) {
					items {
						payout
						source
						timestamp
						txHash
					}
				}
			}
		`,
		{
			pollInterval: 0,
			skip: !myFrontendCode,
		}
	);

	const handleTabOnChange = function (e: string) {
		if (tab === e) {
			setReverse(!reverse);
		} else {
			if (e === headers[1]) setReverse(true);
			else setReverse(false);

			setTab(e);
		}
	};

	const bonusHistory = bonusData?.frontendBonusHistoryMappings?.items || [];
	const data: BonusData[] = bonusHistory.map((item: any) => {
		const dateArr: string[] = new Date(item.timestamp * 1000).toDateString().split(" ");
		const dateStr: string = `${dateArr[2]} ${dateArr[1]} ${dateArr[3]}`;
		return {
			payout: item.payout,
			source: item.source,
			date: dateStr,
			txId: item.txHash,
		};
	});

	const sortedData = sortBonusHistory({ bonusHistory: [...data], headers, tab, reverse });

	const { visibleData, isExpanded, toggleExpanded, showExpandButton } = useExpandableTable(sortedData);

	return (
		<div className="flex flex-col gap-2 sm:gap-0">
			<SectionTitle>{t("referrals.bonus_history")}</SectionTitle>
			<Table>
				<TableHeader headers={headers} subHeaders={subHeaders} tab={tab} tabOnChange={handleTabOnChange} reverse={reverse} />
				<TableBody>
					<>
						{sortedData.length === 0 ? (
							<TableRowEmpty>{t("referrals.no_bonus_history_yet")}</TableRowEmpty>
						) : (
							visibleData.map((row, i) => (
								<TableRow key={i} headers={headers} tab={tab}>
									<div className="text-base sm:font-medium leading-tight text-left">
										{formatCurrency(formatUnits(BigInt(row.payout), 18), 2, 2)}
									</div>
									<div className="text-base sm:font-medium leading-tight">{row.source}</div>
									<div className="text-base sm:font-medium leading-tight">{row.date}</div>
									<div>
										<Link href={TxUrl(row.txId as `0x${string}`)} className="text-base sm:font-medium leading-tight">
											<span>{shortenHash(row.txId as `0x${string}`)}</span>
											<FontAwesomeIcon icon={faArrowUpRightFromSquare} className="w-3 ml-2" />
										</Link>
									</div>
								</TableRow>
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
		</div>
	);
}

function sortBonusHistory(params: { bonusHistory: BonusData[]; headers: string[]; tab: string; reverse: boolean }): BonusData[] {
	const { bonusHistory, headers, tab, reverse } = params;

	if (tab === headers[0]) {
		// payout
		bonusHistory.sort((a, b) => Number(b.payout) - Number(a.payout));
	} else if (tab === headers[1]) {
		// source
		bonusHistory.sort((a, b) => a.source.localeCompare(b.source));
	} else if (tab === headers[2]) {
		// date
		bonusHistory.sort((a, b) => a.date.localeCompare(b.date));
	} else if (tab === headers[3]) {
		// txId
		bonusHistory.sort((a, b) => a.txId.localeCompare(b.txId));
	}

	return reverse ? bonusHistory.reverse() : bonusHistory;
}
