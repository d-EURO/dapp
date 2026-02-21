import { useSelector } from "react-redux";
import { RootState } from "../../redux/redux.store";
import { useBridgeStats } from "@hooks";
import AppCard from "../AppCard";
import { SectionTitle } from "../SectionTitle";
import { formatCurrency } from "../../utils/format";
import { TOKEN_SYMBOL } from "@utils";
import { formatUnits } from "viem";
import { useTranslation } from "next-i18next";

export default function CoverageSummary() {
	const { t } = useTranslation();
	const eco = useSelector((state: RootState) => state.ecosystem);
	const { totalBridgeMinted, isLoading } = useBridgeStats();

	const totalSupply = eco.stablecoinInfo?.total?.supply ?? 0;
	const positionsMinted = eco.exposureData?.exposures?.reduce((sum, e) => sum + e.mint.totalMinted, 0) ?? 0;
	const bridgeMintedNum = parseFloat(formatUnits(totalBridgeMinted, 18));
	const reserveBalance = eco.depsInfo?.reserve?.balance ?? 0;
	const other = Math.max(0, totalSupply - positionsMinted - bridgeMintedNum - reserveBalance);

	const pctPositions = totalSupply > 0 ? (positionsMinted / totalSupply) * 100 : 0;
	const pctBridges = totalSupply > 0 ? (bridgeMintedNum / totalSupply) * 100 : 0;
	const pctReserves = totalSupply > 0 ? (reserveBalance / totalSupply) * 100 : 0;
	const pctOther = totalSupply > 0 ? (other / totalSupply) * 100 : 0;

	const segments = [
		{ label: t("coverage.positions"), pct: pctPositions, value: positionsMinted, color: "bg-blue-500" },
		{ label: t("coverage.bridges"), pct: pctBridges, value: bridgeMintedNum, color: "bg-emerald-500" },
		{ label: t("coverage.reserves"), pct: pctReserves, value: reserveBalance, color: "bg-amber-500" },
		{ label: t("coverage.other"), pct: pctOther, value: other, color: "bg-slate-400" },
	];

	if (!eco.loaded || isLoading) {
		return (
			<AppCard>
				<SectionTitle>{t("coverage.title")}</SectionTitle>
				<p className="text-text-muted">{t("common.loading")}</p>
			</AppCard>
		);
	}

	return (
		<AppCard>
			<SectionTitle>{t("coverage.title")}</SectionTitle>

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

			<div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
				{segments.map((seg) => (
					<div key={seg.label} className="flex items-center gap-2">
						<div className={`w-3 h-3 rounded-full ${seg.color} flex-shrink-0`} />
						<div>
							<div className="text-sm font-semibold">{seg.label}</div>
							<div className="text-sm text-text-muted">
								{formatCurrency(seg.value, 0, 0)} ({seg.pct.toFixed(1)}%)
							</div>
						</div>
					</div>
				))}
			</div>
		</AppCard>
	);
}
