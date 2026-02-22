import { useSelector } from "react-redux";
import { RootState } from "../../redux/redux.store";
import AppCard from "../AppCard";
import { SectionTitle } from "../SectionTitle";
import { formatCurrency } from "../../utils/format";
import { TOKEN_SYMBOL } from "@utils";
import { useTranslation } from "next-i18next";

export default function CoverageReserves() {
	const { t } = useTranslation();
	const eco = useSelector((state: RootState) => state.ecosystem);

	const totalSupply = eco.stablecoinInfo?.total?.supply ?? 0;
	const minterReserve = eco.exposureData?.general?.mintersContribution ?? 0;
	const equityReserve = eco.exposureData?.general?.equityInReserve ?? 0;
	const freeCirculating = Math.max(totalSupply - minterReserve - equityReserve, 0);

	if (!eco.loaded) {
		return (
			<AppCard>
				<SectionTitle>{t("coverage.supply_composition")}</SectionTitle>
				<p className="text-text-muted">{t("common.loading")}</p>
			</AppCard>
		);
	}

	const segments = [
		{ label: t("coverage.free_circulating"), value: freeCirculating, color: "bg-blue-500" },
		{ label: t("coverage.minter_reserve"), value: minterReserve, color: "bg-orange-500" },
		{ label: t("coverage.equity_reserve"), value: equityReserve, color: "bg-purple-500" },
	].map((seg) => ({
		...seg,
		pct: totalSupply > 0 ? (seg.value / totalSupply) * 100 : 0,
	}));

	return (
		<AppCard>
			<SectionTitle>{t("coverage.supply_composition")}</SectionTitle>
			<div className="flex items-baseline gap-2 mb-4">
				<span className="text-2xl font-bold">{formatCurrency(totalSupply, 0, 0)}</span>
				<span className="text-text-muted">{TOKEN_SYMBOL} {t("coverage.total_supply")}</span>
			</div>

			<div className="w-full h-6 rounded-full overflow-hidden flex">
				{segments.map((seg) => (
					seg.pct > 0 && (
						<div
							key={seg.label}
							className={`${seg.color} h-full transition-all`}
							style={{ width: `${seg.pct}%` }}
							title={`${seg.label}: ${seg.pct.toFixed(1)}%`}
						/>
					)
				))}
			</div>

			<div className="flex flex-wrap gap-x-6 gap-y-2 mt-4">
				{segments.map((seg) => (
					<div key={seg.label} className="flex items-center gap-2">
						<div className={`w-3 h-3 rounded-full ${seg.color} flex-shrink-0`} />
						<div>
							<div className="text-sm font-semibold">{seg.label}</div>
							<div className="text-sm text-text-muted">
								{formatCurrency(seg.value, 0, 0)} {TOKEN_SYMBOL} ({seg.pct.toFixed(1)}%)
							</div>
						</div>
					</div>
				))}
			</div>
		</AppCard>
	);
}
