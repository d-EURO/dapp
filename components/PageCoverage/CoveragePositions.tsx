import { useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../../redux/redux.store";
import Table from "../Table";
import TableHeader from "../Table/TableHead";
import TableRow from "../Table/TableRow";
import TokenLogo from "../TokenLogo";
import { SectionTitle } from "../SectionTitle";
import { formatCurrency, shortenAddress } from "../../utils/format";
import { TOKEN_SYMBOL } from "@utils";
import { useTranslation } from "next-i18next";
import { Address, formatUnits } from "viem";
import { WAGMI_CHAIN } from "../../app.config";


export default function CoveragePositions() {
	const { t } = useTranslation();
	const eco = useSelector((state: RootState) => state.ecosystem);
	const openPositions = useSelector((state: RootState) => state.positions.openPositions);
	const prices = useSelector((state: RootState) => state.prices.coingecko);
	const [expandedCollateral, setExpandedCollateral] = useState<string | null>(null);

	const explorerUrl = WAGMI_CHAIN.blockExplorers?.default.url || "https://etherscan.io";

	const exposures = (eco.exposureData?.exposures ?? [])
		.filter((e) => e.mint.totalMinted > 0)
		.sort((a, b) => b.mint.totalMinted - a.mint.totalMinted);

	const headers = [
		t("coverage.collateral"),
		t("coverage.total_collateral"),
		"EUR Value",
		t("coverage.total_minted"),
		t("coverage.collateralization"),
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
						const addr = exp.collateral.address;
						const isExpanded = expandedCollateral === addr;
						const collateralPositions = openPositions.filter((p) => p.collateral.toLowerCase() === addr.toLowerCase());
						const filteredPositions = isExpanded
							? [...collateralPositions].sort((a, b) => Number(BigInt(b.principal) - BigInt(a.principal)))
							: [];
						const totalCollateral = collateralPositions.reduce((sum, p) => sum + BigInt(p.collateralBalance), 0n);
						const collateralDecimals = collateralPositions[0]?.collateralDecimals ?? 18;
						const totalCollateralNum = parseFloat(formatUnits(totalCollateral, collateralDecimals));
						const eurPrice = prices?.[addr.toLowerCase() as Address]?.price?.eur ?? 0;
						const eurValue = totalCollateralNum * eurPrice;

						return (
							<div key={addr}>
								<div
									className="cursor-pointer"
									onClick={() => setExpandedCollateral(isExpanded ? null : addr)}
								>
								<TableRow
									headers={headers}
									tab=""
									className="bg-table-row-primary hover:bg-table-row-hover"
								>
									<div className="flex items-center gap-2 text-left">
										<TokenLogo currency={exp.collateral.symbol} size={6} />
										<div>
											<div className="font-semibold">{exp.collateral.symbol}</div>
											<div className="text-xs text-text-muted">{exp.collateral.name}</div>
										</div>
									</div>
									<div>
										{formatCurrency(formatUnits(totalCollateral, collateralDecimals), 2, 5)} {exp.collateral.symbol}
									</div>
									<div>
										{eurPrice > 0 ? `€${formatCurrency(eurValue, 0, 0)}` : "–"}
									</div>
									<div>
										{formatCurrency(exp.mint.totalMinted, 0, 0)} {TOKEN_SYMBOL}
									</div>
									<div>
										{eurValue > 0 && exp.mint.totalMinted > 0
											? `${formatCurrency((eurValue / exp.mint.totalMinted) * 100, 1, 1)}%`
											: "–"}
									</div>
								</TableRow>
								</div>

								<div className={`grid transition-all duration-300 ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
									<div className="overflow-hidden">
										<div className="bg-table-row-primary border-t border-table-row-hover px-5 sm:px-8">
											<div className="grid grid-cols-5 gap-4 py-2 text-xs text-text-muted font-semibold">
												<div>Position</div>
												<div className="text-right">{t("coverage.total_collateral")}</div>
												<div className="text-right">EUR Value</div>
												<div className="text-right">{t("coverage.total_minted")}</div>
												<div className="text-right">{t("coverage.collateralization")}</div>
											</div>
											{filteredPositions.map((pos) => {
												const posCollBal = parseFloat(formatUnits(BigInt(pos.collateralBalance), pos.collateralDecimals));
												const posEurVal = posCollBal * eurPrice;
												const posMinted = parseFloat(formatUnits(BigInt(pos.principal), 18));
												const posCollPct = posEurVal > 0 && posMinted > 0 ? (posEurVal / posMinted) * 100 : 0;

												return (
													<div key={pos.position} className="grid grid-cols-5 gap-4 py-2 border-t border-table-row-hover text-sm">
														<div>
															<a
																href={`${explorerUrl}/token/${pos.collateral}?a=${pos.position}`}
																target="_blank"
																rel="noopener noreferrer"
																className="underline hover:text-text-primary"
															>
																{shortenAddress(pos.position)}
															</a>
														</div>
														<div className="text-right">
															{formatCurrency(formatUnits(BigInt(pos.collateralBalance), pos.collateralDecimals), 2, 5)}{" "}
															{pos.collateralSymbol}
														</div>
														<div className="text-right">
															{eurPrice > 0 ? `€${formatCurrency(posEurVal, 0, 0)}` : "–"}
														</div>
														<div className="text-right">
															{formatCurrency(formatUnits(BigInt(pos.principal), 18), 2, 2)} {TOKEN_SYMBOL}
														</div>
														<div className="text-right">
															{posCollPct > 0 ? `${formatCurrency(posCollPct, 1, 1)}%` : "–"}
														</div>
													</div>
												);
											})}
										</div>
									</div>
								</div>
							</div>
						);
					}),
				]}
			</Table>
		</div>
	);
}
