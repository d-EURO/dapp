import TableHeader from "../Table/TableHead";
import TableBody from "../Table/TableBody";
import Table from "../Table";
import TableRowEmpty from "../Table/TableRowEmpty";
import { TableShowMoreRow } from "@components/Table/TableShowMoreRow";
import { useSelector } from "react-redux";
import { RootState } from "../../redux/redux.store";
import { useState } from "react";
import { SavingsInterestQuery } from "@juicedollar/api";
import SavingsInterestRow from "./SavingsInterestRow";
import { useTranslation } from "next-i18next";
import { useExpandableTable } from "@hooks";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons";

export default function SavingsInterestTable() {
	const { t } = useTranslation();
	const headers: string[] = [t("savings.date"), t("savings.saver"), t("savings.interest"), t("savings.rate"), t("savings.balance")];
	const [tab, setTab] = useState<string>(headers[0]);
	const [reverse, setReverse] = useState<boolean>(false);

	const savingsAllUserTable = useSelector((state: RootState) => state.savings.savingsAllUserTable);
	const interest = savingsAllUserTable?.interest || [];
	const sorted: SavingsInterestQuery[] = interest;
	const { visibleData, isExpanded, toggleExpanded, showExpandButton } = useExpandableTable(sorted);

	if (!interest.length) return null;

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
			<TableHeader headers={headers} tab={tab} reverse={reverse} tabOnChange={handleTabOnChange} />
			<TableBody>
				<>
					{sorted.length == 0 ? (
						<TableRowEmpty>{t("savings.no_interest_claims_yet")}</TableRowEmpty>
					) : (
						visibleData.map((r, idx) => <SavingsInterestRow headers={headers} key={r.id} item={r} tab={tab} />)
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
