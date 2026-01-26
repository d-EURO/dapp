import TableHeader from "../Table/TableHead";
import TableBody from "../Table/TableBody";
import Table from "../Table";
import TableRowEmpty from "../Table/TableRowEmpty";
import { TableShowMoreRow } from "@components/Table/TableShowMoreRow";
import { useSelector } from "react-redux";
import { RootState } from "../../redux/redux.store";
import { useState } from "react";
import { LeadrateProposed } from "@juicedollar/api";
import GovernanceLeadrateRow from "./GovernanceLeadrateRow";
import { useTranslation } from "next-i18next";
import { useExpandableTable } from "@hooks";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons";

export default function GovernanceLeadrateTable() {
	const { t } = useTranslation();
	const headers: string[] = [t("governance.date"), t("governance.proposer"), t("governance.rate"), t("governance.state")];
	const [tab, setTab] = useState<string>(headers[3]);
	const [reverse, setReverse] = useState<boolean>(false);

	const info = useSelector((state: RootState) => state.savings.leadrateInfo);
	const proposals = useSelector((state: RootState) => state.savings.leadrateProposed);
	const rates = useSelector((state: RootState) => state.savings.leadrateRate);
	const currentProposal = proposals && proposals.list.length > 0 ? proposals.list[0] : undefined;
	const sorted: LeadrateProposed[] = proposals?.list || [];
	const { visibleData, isExpanded, toggleExpanded, showExpandButton } = useExpandableTable(sorted);

	if (!info || !proposals || !rates) return null;

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
			<TableHeader headers={headers} tab={tab} reverse={reverse} tabOnChange={handleTabOnChange} actionCol />
			<TableBody>
				<>
					{sorted.length == 0 ? (
						<TableRowEmpty>{t("governance.proposals_table_empty")}</TableRowEmpty>
					) : (
						visibleData.map((p, idx) => (
							<GovernanceLeadrateRow
								headers={headers}
								key={p.id}
								info={info}
								proposal={p}
								currentProposal={currentProposal?.id == p.id}
								tab={tab}
							/>
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
