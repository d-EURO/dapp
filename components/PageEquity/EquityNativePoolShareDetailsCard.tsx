import { useState, useMemo } from "react";
import { usePoolStats, useTradeQuery } from "@hooks";
import dynamic from "next/dynamic";
import { formatCurrency, NATIVE_POOL_SHARE_TOKEN_SYMBOL, POOL_SHARE_TOKEN_SYMBOL, TOKEN_SYMBOL } from "@utils";
const ApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });
import { useTranslation } from "next-i18next";
import { formatUnits } from "viem";
import { SegmentedControlButton } from "@components/Button";
import TokenLogo from "@components/TokenLogo";
import { useSelector } from "react-redux";
import { RootState } from "../../redux/redux.store";

enum Timeframe {
	WEEK = "1W",
	MONTH = "1M",
	QUARTER = "1Q",
	YEAR = "1Y",
	ALL = "All",
}

const getStartTimestampByTimeframe = (timeframe: Timeframe) => {
	switch (timeframe) {
		case Timeframe.ALL:
			return 0;
		case Timeframe.WEEK:
			return Date.now() - 7 * 24 * 60 * 60 * 1000;
		case Timeframe.MONTH:
			return Date.now() - 30 * 24 * 60 * 60 * 1000;
		case Timeframe.QUARTER:
			return Date.now() - 90 * 24 * 60 * 60 * 1000;
		case Timeframe.YEAR:
			return Date.now() - 365 * 24 * 60 * 60 * 1000;
		default:
			return 0;
	}
};

export default function EquityNativePoolShareDetailsCard() {
	const [timeframe, setTimeframe] = useState<Timeframe>(Timeframe.ALL);
	const poolStats = usePoolStats();
	const { profit, loss, unrealizedProfit } = useSelector((state: RootState) => state.ecosystem.depsInfo.earnings);
	const { trades } = useTradeQuery();
	const { t } = useTranslation();
	const startTrades = getStartTimestampByTimeframe(timeframe);

	const filteredTrades = useMemo(() => trades.filter((trade) => {
		return parseFloat(trade.time) * 1000 > startTrades;
	}), [trades, startTrades]);

	const maxPrice = useMemo(() => Math.max(...filteredTrades.map((trade) => Math.round(Number(trade.lastPrice) / 10 ** 16) / 100)), [filteredTrades]);

	return (
		<div className="bg-layout-primary border border-borders-dividerLight border-offset-1 rounded-xl grid grid-cols-1">
			<div id="chart-timeline" className="relative">
				<div className="absolute top-[20px] left-[20px] z-10 gap-2 flex flex-col items-start">
					<TokenLogo currency={NATIVE_POOL_SHARE_TOKEN_SYMBOL} size={7} />
					<div>
						<span className="text-base font-extrabold leading-tight">
							{formatCurrency(formatUnits(poolStats.equityPrice, 18), 4, 4)}
						</span>{" "}
						<span className="text-base font-[350] leading-tight">{TOKEN_SYMBOL}</span>
					</div>
				</div>
				<ApexChart
					type="area"
					options={{
						theme: {
							monochrome: {
								color: "#0D4E9C",
								enabled: true,
							},
						},
						chart: {
							type: "area",
							height: 300,
							width: 650,
							dropShadow: {
								enabled: false,
							},
							toolbar: {
								show: false,
							},
							zoom: {
								enabled: false,
							},
							background: "0",
						},
						stroke: {
							width: 3,
						},
						dataLabels: {
							enabled: false,
						},
						grid: {
							show: false,
						},
						xaxis: {
							type: "datetime",
							labels: {
								show: false,
							},
							axisBorder: {
								show: false,
							},
							axisTicks: {
								show: false,
							},
						},
						yaxis: {
							show: false,
							min: 0,
							max: maxPrice * 2,
						},
						fill: {
							colors: ["#0F80F099"],
							type: "gradient",
							gradient: {
								type: "vertical",
								opacityFrom: 1,
								opacityTo: 0.95,
								gradientToColors: ["#F5F6F9"],
							},
						},
					}}
					series={[
						{
							name: `${POOL_SHARE_TOKEN_SYMBOL} Price`,
							data: filteredTrades.map((trade) => {
								return [parseFloat(trade.time) * 1000, Number(((Number(trade.lastPrice) / 10 ** 16) / 100).toFixed(4))];
							}),
						},
					]}
				/>
			</div>
			<div className="py-4 flex flex-row justify-center items-center">
				{Object.values(Timeframe).map((_timeframe) => (
					<SegmentedControlButton
						selected={_timeframe === timeframe}
						onClick={() => setTimeframe(_timeframe)}
					>
						{_timeframe}
					</SegmentedControlButton>
				))}
			</div>
			<div className="flex flex-col justify-start gap-3 py-6 px-5 border-t border-borders-dividerLight border-offset-1">
				<div className="flex flex-row justify-between">
					<div className="text-sm font-medium leading-relaxed">{t("equity.supply")}</div>
					<div className="text-sm font-medium leading-tight ">
						{formatCurrency(formatUnits(poolStats.equitySupply, 18), 2, 2)} {NATIVE_POOL_SHARE_TOKEN_SYMBOL}
					</div>
				</div>
				<div className="flex flex-row justify-between">
					<div className="text-sm font-medium leading-relaxed">{t("equity.market_cap")}</div>
					<div className="text-sm font-medium leading-tight ">
						{formatCurrency(formatUnits((poolStats.equitySupply * poolStats.equityPrice) / BigInt(1e18), 18), 2, 2)} {TOKEN_SYMBOL}
					</div>
				</div>
				<div className="flex flex-row justify-between">
					<div className="text-sm font-medium leading-relaxed">{t("equity.total_reserve")}</div>
					<div className="text-sm font-medium leading-tight ">
						{formatCurrency(formatUnits(poolStats.deuroTotalReserve, 18), 2, 2)} {TOKEN_SYMBOL}
					</div>
				</div>
				<div className="flex flex-row justify-between">
					<div className="text-sm font-medium leading-relaxed">{t("equity.equity_capital")}</div>
					<div className="text-sm font-medium leading-tight ">
						{formatCurrency(formatUnits(poolStats.deuroEquity, 18), 2, 2)} {TOKEN_SYMBOL}
					</div>
				</div>
				<div className="flex flex-row justify-between">
					<div className="text-sm font-medium leading-relaxed">{t("equity.minter_reserve")}</div>
					<div className="text-sm font-medium leading-tight ">
						{formatCurrency(formatUnits(poolStats.deuroMinterReserve, 18), 2, 2)} {TOKEN_SYMBOL}
					</div>
				</div>
				<div className="flex flex-row justify-between">
					<div className="text-sm font-medium leading-relaxed">{t("equity.total_income")}</div>
					<div className="text-sm font-medium leading-tight ">
						{formatCurrency(profit + unrealizedProfit - loss + 300000, 2, 2)} {TOKEN_SYMBOL} {/* 300k was sent directly to Equity contract */}
					</div>
				</div>
			</div>
		</div>
	);
}
