import { useSelector } from "react-redux";
import { RootState } from "../../redux/redux.store";
import AppCard from "../AppCard";
import { SectionTitle } from "../SectionTitle";
import { formatCurrency } from "../../utils/format";
import { TOKEN_SYMBOL } from "@utils";
import { useTranslation } from "next-i18next";

function StatRow({ label, value, bold }: { label: string; value: string | null | undefined; bold?: boolean }) {
	return (
		<div className={`flex justify-between py-1.5 ${bold ? "font-bold border-t border-table-row-hover mt-1 pt-2" : ""}`}>
			<span className="text-text-muted">{label}</span>
			<span>{value ?? "—"} {TOKEN_SYMBOL}</span>
		</div>
	);
}

export default function CoverageReserves() {
	const { t } = useTranslation();
	const eco = useSelector((state: RootState) => state.ecosystem);
	const depsInfo = eco.depsInfo;

	if (!depsInfo) {
		return null;
	}

	const reserve = depsInfo.reserve;
	const earnings = depsInfo.earnings;
	const netEarnings = (earnings?.profit ?? 0) - (earnings?.loss ?? 0) + (earnings?.unrealizedProfit ?? 0);

	return (
		<div>
			<SectionTitle>{t("coverage.reserves_earnings")}</SectionTitle>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<AppCard>
					<h3 className="font-bold text-lg mb-2">{t("coverage.reserve_breakdown")}</h3>
					<StatRow label={t("coverage.total_reserve")} value={formatCurrency(reserve?.balance ?? 0, 0, 0)} />
					<StatRow label={t("coverage.minter_reserve")} value={formatCurrency(reserve?.minter ?? 0, 0, 0)} />
					<StatRow label={t("coverage.equity_reserve")} value={formatCurrency(reserve?.equity ?? 0, 0, 0)} />
				</AppCard>
				<AppCard>
					<h3 className="font-bold text-lg mb-2">{t("coverage.earnings")}</h3>
					<StatRow label={t("coverage.profit")} value={formatCurrency(earnings?.profit ?? 0, 0, 0)} />
					<StatRow label={t("coverage.loss")} value={formatCurrency(earnings?.loss ?? 0, 0, 0)} />
					<StatRow label={t("coverage.unrealized_profit")} value={formatCurrency(earnings?.unrealizedProfit ?? 0, 0, 0)} />
					<StatRow label={t("coverage.net_earnings")} value={formatCurrency(netEarnings, 0, 0)} bold />
				</AppCard>
			</div>
		</div>
	);
}
