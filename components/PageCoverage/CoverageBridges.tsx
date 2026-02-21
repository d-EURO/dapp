import { useBridgeStats } from "@hooks";
import Table from "../Table";
import TableHeader from "../Table/TableHead";
import TableRow from "../Table/TableRow";
import TokenLogo from "../TokenLogo";
import { SectionTitle } from "../SectionTitle";
import { TOKEN_SYMBOL } from "@utils";
import { useTranslation } from "next-i18next";
import { formatUnits } from "viem";
import { formatCurrency } from "../../utils/format";

function formatAmount(value: bigint): string {
	const num = parseFloat(formatUnits(value, 18));
	if (num < 1 && num > 0) return "0";
	return formatCurrency(Math.round(num), 0, 0) ?? "0";
}

export default function CoverageBridges() {
	const { t } = useTranslation();
	const { bridges: allBridges, isLoading } = useBridgeStats();
	const bridges = allBridges.filter((b) => b.minted > 0n);

	const headers = [
		t("coverage.stablecoin"),
		t("coverage.minted"),
		t("coverage.limit"),
		t("coverage.utilization"),
		t("coverage.status"),
	];

	if (isLoading) {
		return (
			<div>
				<SectionTitle>{t("coverage.stablecoin_bridges")}</SectionTitle>
				<p className="text-text-muted">{t("common.loading")}</p>
			</div>
		);
	}

	return (
		<div>
			<SectionTitle>{t("coverage.stablecoin_bridges")}</SectionTitle>
			<Table>
				{[
					<TableHeader key="header" headers={headers} />,
					...bridges.map((bridge) => {
						const minted = bridge.minted;
						const limit = bridge.limit;
						const utilization = limit > 0n
							? Number((minted * 10000n) / limit) / 100
							: 0;

						return (
							<TableRow key={bridge.bridgeAddress} headers={headers} tab="">
								<div className="flex items-center gap-2 text-left">
									<TokenLogo currency={bridge.symbol} size={6} />
									<span className="font-semibold">{bridge.symbol}</span>
								</div>
								<div>
									{formatAmount(minted)} {TOKEN_SYMBOL}
								</div>
								<div>
									{formatAmount(limit)} {TOKEN_SYMBOL}
								</div>
								<div className="flex flex-col items-end gap-1">
									<span>{utilization.toFixed(1)}%</span>
									<div className="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden">
										<div
											className="h-full rounded-full bg-emerald-500"
											style={{ width: `${Math.min(utilization, 100)}%` }}
										/>
									</div>
								</div>
								<div>
									<span
										className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
											bridge.isExpired
												? "bg-red-100 text-red-700"
												: "bg-green-100 text-green-700"
										}`}
									>
										{bridge.isExpired ? t("coverage.expired") : t("coverage.active")}
									</span>
								</div>
							</TableRow>
						);
					}),
				]}
			</Table>
		</div>
	);
}
