import { useSelector } from "react-redux";
import { RootState } from "../../redux/redux.store";
import { useBridgeStats } from "@hooks";
import AppCard from "../AppCard";
import { SectionTitle } from "../SectionTitle";
import { formatCurrency } from "../../utils/format";
import { Address, formatUnits } from "viem";
import { useTranslation } from "next-i18next";

const COLLATERAL_COLORS = ["bg-blue-500", "bg-indigo-500", "bg-violet-500", "bg-sky-500", "bg-blue-400"];
const BRIDGE_COLORS = ["bg-emerald-500", "bg-teal-500", "bg-cyan-500", "bg-green-500", "bg-lime-500"];

export default function CoverageTVL() {
	const { t } = useTranslation();
	const openPositions = useSelector((state: RootState) => state.positions.openPositions);
	const prices = useSelector((state: RootState) => state.prices.coingecko);
	const positionsLoaded = useSelector((state: RootState) => state.positions.loaded);
	const { bridges, isLoading: bridgesLoading } = useBridgeStats();

	if (!positionsLoaded || bridgesLoading) {
		return (
			<AppCard>
				<SectionTitle>{t("coverage.tvl")}</SectionTitle>
				<p className="text-text-muted">{t("common.loading")}</p>
			</AppCard>
		);
	}

	// Collateral value: group by collateral symbol
	const collateralBySymbol = new Map<string, number>();
	for (const pos of openPositions) {
		const eurPrice = prices?.[pos.collateral.toLowerCase() as Address]?.price?.eur ?? 0;
		const balance = parseFloat(formatUnits(BigInt(pos.collateralBalance), pos.collateralDecimals));
		const value = balance * eurPrice;
		collateralBySymbol.set(pos.collateralSymbol, (collateralBySymbol.get(pos.collateralSymbol) ?? 0) + value);
	}

	const collateralSegments = Array.from(collateralBySymbol.entries())
		.sort((a, b) => b[1] - a[1])
		.map(([symbol, value], i) => ({
			label: symbol,
			value,
			color: COLLATERAL_COLORS[i % COLLATERAL_COLORS.length],
		}));

	// Bridge balances: individual per asset
	const ONE_DEURO = 10n ** 18n;
	const bridgeSegments = bridges
		.filter((b) => b.minted >= ONE_DEURO)
		.map((b, i) => ({
			label: b.symbol,
			value: parseFloat(formatUnits(b.minted, 18)),
			color: BRIDGE_COLORS[i % BRIDGE_COLORS.length],
		}));

	const collateralValueEur = collateralSegments.reduce((sum, s) => sum + s.value, 0);
	const bridgeValueEur = bridgeSegments.reduce((sum, s) => sum + s.value, 0);
	const tvl = collateralValueEur + bridgeValueEur;

	const segments = [
		...collateralSegments,
		...bridgeSegments,
	].map((seg) => ({
		...seg,
		pct: tvl > 0 ? (seg.value / tvl) * 100 : 0,
	}));

	return (
		<AppCard>
			<SectionTitle>{t("coverage.tvl")}</SectionTitle>
			<div className="flex items-baseline gap-2 mb-4">
				<span className="text-2xl font-bold">€{formatCurrency(tvl, 0, 0)}</span>
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
								€{formatCurrency(seg.value, 0, 0)} ({seg.pct.toFixed(1)}%)
							</div>
						</div>
					</div>
				))}
			</div>
		</AppCard>
	);
}
