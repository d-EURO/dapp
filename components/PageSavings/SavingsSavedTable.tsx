import TableHeader from "../Table/TableHead";
import TableBody from "../Table/TableBody";
import Table from "../Table";
import TableRowEmpty from "../Table/TableRowEmpty";
import { TableShowMoreRow } from "@components/Table/TableShowMoreRow";
import { useSelector } from "react-redux";
import { RootState } from "../../redux/redux.store";
import { useState } from "react";
import { SavingsSavedQuery } from "@juicedollar/api";
import SavingsSavedRow from "./SavingsSavedRow";
import { useTranslation } from "next-i18next";
import { useExpandableTable } from "@hooks";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons";

export default function GovernanceLeadrateTable() {
	const { t } = useTranslation();
	const headers: string[] = [t("savings.date"), t("savings.saver"), t("savings.amount"), t("savings.rate"), t("savings.balance")];
	const [tab, setTab] = useState<string>(headers[0]);
	const [reverse, setReverse] = useState<boolean>(false);

	const savingsAllUserTable = useSelector((state: RootState) => state.savings.savingsAllUserTable);
	const save = savingsAllUserTable?.save || [];
	const sorted: SavingsSavedQuery[] = save;
	const { visibleData, isExpanded, toggleExpanded, showExpandButton } = useExpandableTable(sorted);

	if (!save.length) return null;

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
				className={sorted.length == 0 ? "!hidden" : ""}
				headers={headers}
				tab={tab}
				reverse={reverse}
				tabOnChange={handleTabOnChange}
				headerClassNames={["text-center"]}
			/>
			<TableBody>
				<>
					{sorted.length == 0 ? (
						<TableRowEmpty className={sorted.length == 0 ? "!rounded-t-lg" : ""}>{t("savings.no_savings_yet")}</TableRowEmpty>
					) : (
						visibleData.map((r, idx) => <SavingsSavedRow headers={headers} key={r.id} item={r} tab={tab} />)
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
