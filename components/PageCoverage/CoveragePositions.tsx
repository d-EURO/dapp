import { useSelector } from "react-redux";
import { RootState } from "../../redux/redux.store";
import Table from "../Table";
import TableHeader from "../Table/TableHead";
import TableRow from "../Table/TableRow";
import TokenLogo from "../TokenLogo";
import { SectionTitle } from "../SectionTitle";
import { formatCurrency } from "../../utils/format";
import { TOKEN_SYMBOL } from "@utils";
import { useTranslation } from "next-i18next";

export default function CoveragePositions() {
	const { t } = useTranslation();
	const eco = useSelector((state: RootState) => state.ecosystem);

	const exposures = (eco.exposureData?.exposures ?? [])
		.filter((e) => e.mint.totalMinted > 0)
		.sort((a, b) => b.mint.totalMinted - a.mint.totalMinted);

	const headers = [
		t("coverage.collateral"),
		t("coverage.open_positions"),
		t("coverage.total_minted"),
		t("coverage.interest_avg"),
		t("coverage.utilization"),
	];

	if (exposures.length === 0) {
		return null;
	}

	return (
		<div>
			<SectionTitle>{t("coverage.collateral_positions")}</SectionTitle>
			<Table>
				{[
					<TableHeader key="header" headers={headers} />,
					...exposures.map((exp) => {
						const utilization = exp.mint.totalLimit > 0
							? (exp.mint.totalMinted / exp.mint.totalLimit) * 100
							: 0;

						return (
							<TableRow key={exp.collateral.address} headers={headers} tab="">
								<div className="flex items-center gap-2 text-left">
									<TokenLogo currency={exp.collateral.symbol} size={6} />
									<div>
										<div className="font-semibold">{exp.collateral.symbol}</div>
										<div className="text-xs text-text-muted">{exp.collateral.name}</div>
									</div>
								</div>
								<div>{exp.positions.open}</div>
								<div>
									{formatCurrency(exp.mint.totalMinted, 0, 0)} {TOKEN_SYMBOL}
								</div>
								<div>{(exp.mint.interestAverage * 100).toFixed(1)}%</div>
								<div className="flex flex-col items-end gap-1">
									<span>{utilization.toFixed(1)}%</span>
									<div className="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden">
										<div
											className="h-full rounded-full bg-blue-500"
											style={{ width: `${Math.min(utilization, 100)}%` }}
										/>
									</div>
								</div>
							</TableRow>
						);
					}),
				]}
			</Table>
		</div>
	);
}
