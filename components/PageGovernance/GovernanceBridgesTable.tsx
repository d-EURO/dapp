import TableHeader from "../Table/TableHead";
import TableBody from "../Table/TableBody";
import Table from "../Table";
import TableRowEmpty from "../Table/TableRowEmpty";
import { useState } from "react";
import { BridgeStat, useBridgeStats } from "@hooks";
import GovernanceBridgesRow from "./GovernanceBridgesRow";
import { useTranslation } from "next-i18next";

export default function GovernanceBridgesTable() {
	const { t } = useTranslation();
	const headers: string[] = [t("governance.bridge"), t("governance.minted_limit"), t("governance.utilization"), t("governance.expiry")];
	const [tab, setTab] = useState<string>(headers[0]);
	const [reverse, setReverse] = useState<boolean>(false);

	const { bridges, isLoading } = useBridgeStats();
	const activeBridges = bridges.filter((b) => !b.isExpired && (b.limit > 0n || b.minted > 0n));

	if (isLoading || activeBridges.length === 0) return null;

	const sorted: BridgeStat[] = sortBridges({
		bridges: [...activeBridges],
		headers,
		tab,
		reverse,
	});

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
				{sorted.length == 0 ? (
					<TableRowEmpty>{t("governance.bridges_table_empty")}</TableRowEmpty>
				) : (
					sorted.map((b) => <GovernanceBridgesRow key={b.bridgeAddress} headers={headers} bridge={b} tab={tab} />)
				)}
			</TableBody>
		</Table>
	);
}

type SortBridges = {
	bridges: BridgeStat[];
	headers: string[];
	tab: string;
	reverse: boolean;
};

function sortBridges(params: SortBridges): BridgeStat[] {
	const { bridges, headers, tab, reverse } = params;

	if (tab === headers[0]) {
		bridges.sort((a, b) => a.symbol.localeCompare(b.symbol));
	} else if (tab === headers[1]) {
		bridges.sort((a, b) => Number(b.minted - a.minted));
	} else if (tab === headers[2]) {
		const util = (b: BridgeStat) => (b.limit > 0n ? Number((b.minted * 10000n) / b.limit) : 0);
		bridges.sort((a, b) => util(b) - util(a));
	} else if (tab === headers[3]) {
		bridges.sort((a, b) => Number(a.horizon - b.horizon));
	}

	return reverse ? bridges.reverse() : bridges;
}
