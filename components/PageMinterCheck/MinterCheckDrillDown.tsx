import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../../redux/redux.store";
import { useBridgeStats } from "@hooks";
import AppCard from "../AppCard";
import { SectionTitle } from "../SectionTitle";
import TokenLogo from "../TokenLogo";
import { formatCurrency, shortenAddress, TOKEN_SYMBOL } from "@utils";
import { formatUnits } from "viem";
import { useTranslation } from "next-i18next";
import { WAGMI_CHAIN } from "../../app.config";
import { ADDRESS } from "@deuro/eurocoin";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

type Category = "positions" | "bridges";

export default function MinterCheckDrillDown() {
	const { t } = useTranslation();
	const eco = useSelector((state: RootState) => state.ecosystem);
	const openPositions = useSelector((state: RootState) => state.positions.openPositions);
	const { bridges: allBridges, totalBridgeMinted, isLoading } = useBridgeStats();

	const [isLevel1Open, setIsLevel1Open] = useState(false);
	const [expandedCategory, setExpandedCategory] = useState<Category | null>(null);
	const [expandedCollateral, setExpandedCollateral] = useState<string | null>(null);
	const [expandedBridgeSymbol, setExpandedBridgeSymbol] = useState<string | null>(null);

	const explorerUrl = WAGMI_CHAIN.blockExplorers?.default.url ?? "https://etherscan.io";
	const deuroAddress = ADDRESS[WAGMI_CHAIN.id].decentralizedEURO;

	const totalSupply = eco.stablecoinInfo?.total?.supply ?? 0;

	const exposures = (eco.exposureData?.exposures ?? [])
		.filter((e) => e.mint.totalMinted > 0)
		.sort((a, b) => b.mint.totalMinted - a.mint.totalMinted);

	const positionsMinted = exposures.reduce((sum, e) => sum + e.mint.totalMinted, 0);
	const bridgeMintedNum = parseFloat(formatUnits(totalBridgeMinted, 18));

	const pctPositions = totalSupply > 0 ? (positionsMinted / totalSupply) * 100 : 0;
	const pctBridges = totalSupply > 0 ? (bridgeMintedNum / totalSupply) * 100 : 0;

	const bridges = useMemo(() => {
		const ONE_DEURO = 10n ** 18n;
		return allBridges.filter((b) => b.minted >= ONE_DEURO);
	}, [allBridges]);

	const bridgeGroups = useMemo(() => {
		const bridgesBySymbol = bridges.reduce<Record<string, typeof bridges>>((acc, bridge) => {
			const key = bridge.symbol;
			if (!acc[key]) acc[key] = [];
			acc[key].push(bridge);
			return acc;
		}, {});

		return Object.entries(bridgesBySymbol)
			.map(([symbol, items]) => {
				const totalMinted = items.reduce((sum, b) => sum + parseFloat(formatUnits(b.minted, 18)), 0);
				return { symbol, items, totalMinted };
			})
			.sort((a, b) => b.totalMinted - a.totalMinted);
	}, [bridges]);

	const positionsByCollateral = useMemo(() => {
		const map = new Map<string, typeof openPositions>();
		for (const p of openPositions) {
			if (BigInt(p.principal) <= 0n) continue;
			const key = p.collateral.toLowerCase();
			const list = map.get(key) ?? [];
			list.push(p);
			map.set(key, list);
		}
		for (const [, list] of map) {
			list.sort((a, b) => Number(BigInt(b.principal) - BigInt(a.principal)));
		}
		return map;
	}, [openPositions]);

	const toggleCategory = (cat: Category) => {
		setExpandedCategory(expandedCategory === cat ? null : cat);
	};

	if (!eco.loaded || isLoading) {
		return (
			<AppCard>
				<SectionTitle>{t("minter_check.title")}</SectionTitle>
				<p className="text-text-muted">{t("common.loading")}</p>
			</AppCard>
		);
	}

	return (
		<AppCard>
			<SectionTitle>{t("minter_check.title")}</SectionTitle>
			<p className="text-text-muted mb-4">{t("minter_check.description")}</p>

			{/* LEVEL 0: Total Supply */}
			<button
				onClick={() => setIsLevel1Open(!isLevel1Open)}
				aria-expanded={isLevel1Open}
				className="w-full flex items-center justify-between p-4 rounded-xl bg-layout-primary hover:opacity-80 transition-opacity"
			>
				<div className="flex items-center gap-2">
					<span className="font-semibold">{t("minter_check.total_supply")}</span>
					<a
						href={`${explorerUrl}/token/${deuroAddress}`}
						target="_blank"
						rel="noopener noreferrer"
						className="text-sm text-link hover:underline"
						onClick={(e) => e.stopPropagation()}
					>
						{shortenAddress(deuroAddress)}
					</a>
				</div>
				<div className="flex items-center gap-2">
					<span className="text-text-muted">
						{formatCurrency(totalSupply, 0, 0)} {TOKEN_SYMBOL} (100%)
					</span>
					<FontAwesomeIcon
						icon={faChevronDown}
						className={`w-4 h-4 transition-transform duration-300 ${isLevel1Open ? "rotate-180" : ""}`}
					/>
				</div>
			</button>

			{/* LEVEL 1: Categories */}
			<div className={`grid transition-all duration-300 ${isLevel1Open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
				<div className="overflow-hidden">
					<div className="flex flex-col gap-2 pt-3">
						{/* Collateral Positions */}
						<div>
							<button
								onClick={() => toggleCategory("positions")}
								aria-expanded={expandedCategory === "positions"}
								className="w-full flex flex-col gap-1.5 p-3 rounded-lg bg-layout-primary hover:opacity-80 transition-opacity"
							>
								<div className="w-full flex items-center justify-between">
									<span className="font-semibold">{t("minter_check.collateral_positions")}</span>
									<div className="flex items-center gap-2">
										<span className="text-text-muted">
											{formatCurrency(positionsMinted, 0, 0)} {TOKEN_SYMBOL} ({pctPositions.toFixed(1)}%)
										</span>
										<FontAwesomeIcon
											icon={faChevronDown}
											className={`w-3 h-3 transition-transform duration-300 ${expandedCategory === "positions" ? "rotate-180" : ""}`}
										/>
									</div>
								</div>
								<div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
									<div
										className="h-full rounded-full bg-blue-500 transition-all"
										style={{ width: `${pctPositions}%` }}
									/>
								</div>
							</button>

							{/* LEVEL 2: Individual Collateral Types */}
							<div className={`grid transition-all duration-300 ${expandedCategory === "positions" ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
								<div className="overflow-hidden">
									<div className="flex flex-col gap-1 pl-5 pt-1">
										{exposures.map((exp) => {
											const addr = exp.collateral.address;
											const isExpanded = expandedCollateral === addr;
											const collateralPositions = positionsByCollateral.get(addr.toLowerCase()) ?? [];
											const pctOfTotal = totalSupply > 0 ? (exp.mint.totalMinted / totalSupply) * 100 : 0;

											return (
												<div key={addr}>
													<button
														onClick={() => setExpandedCollateral(isExpanded ? null : addr)}
														aria-expanded={isExpanded}
														className="w-full flex flex-col gap-1.5 p-2 rounded-lg hover:bg-layout-primary transition-colors"
													>
														<div className="w-full flex items-center justify-between">
															<div className="flex items-center gap-2">
																<TokenLogo currency={exp.collateral.symbol} size={6} />
																<span className="font-semibold">{exp.collateral.symbol}</span>
															</div>
															<div className="flex items-center gap-2">
																<span className="text-text-muted">
																	{formatCurrency(exp.mint.totalMinted, 0, 0)} {TOKEN_SYMBOL} ({pctOfTotal.toFixed(1)}%)
																</span>
																<FontAwesomeIcon
																	icon={faChevronDown}
																	className={`w-3 h-3 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
																/>
															</div>
														</div>
														<div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
															<div
																className="h-full rounded-full bg-blue-500 transition-all"
																style={{ width: `${pctOfTotal}%` }}
															/>
														</div>
													</button>

													{/* LEVEL 3: Individual Positions */}
													<div className={`grid transition-all duration-300 ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
														<div className="overflow-hidden">
															<div className="flex flex-col gap-1 pl-5 pb-1">
																{collateralPositions.map((pos) => {
																	const minted = parseFloat(formatUnits(BigInt(pos.principal), 18));
																	const pctPos = totalSupply > 0 ? (minted / totalSupply) * 100 : 0;
																	return (
																		<a
																			key={pos.position}
																			href={`${explorerUrl}/address/${pos.position}`}
																			target="_blank"
																			rel="noopener noreferrer"
																			className="flex flex-col gap-1 p-2 rounded-lg hover:bg-layout-primary transition-colors text-sm"
																		>
																			<div className="flex items-center justify-between">
																				<span className="text-link hover:underline">
																					{shortenAddress(pos.position)}
																				</span>
																				<span className="text-text-muted">
																					{formatCurrency(minted, 0, 0)} {TOKEN_SYMBOL} ({pctPos.toFixed(1)}%)
																				</span>
																			</div>
																			<div className="w-full h-1 rounded-full bg-slate-200 overflow-hidden">
																				<div
																					className="h-full rounded-full bg-blue-400 transition-all"
																					style={{ width: `${pctPos}%` }}
																				/>
																			</div>
																		</a>
																	);
																})}
															</div>
														</div>
													</div>
												</div>
											);
										})}
									</div>
								</div>
							</div>
						</div>

						{/* Bridge Minters */}
						<div>
							<button
								onClick={() => toggleCategory("bridges")}
								aria-expanded={expandedCategory === "bridges"}
								className="w-full flex flex-col gap-1.5 p-3 rounded-lg bg-layout-primary hover:opacity-80 transition-opacity"
							>
								<div className="w-full flex items-center justify-between">
									<span className="font-semibold">{t("minter_check.bridge_minters")}</span>
									<div className="flex items-center gap-2">
										<span className="text-text-muted">
											{formatCurrency(bridgeMintedNum, 0, 0)} {TOKEN_SYMBOL} ({pctBridges.toFixed(1)}%)
										</span>
										<FontAwesomeIcon
											icon={faChevronDown}
											className={`w-3 h-3 transition-transform duration-300 ${expandedCategory === "bridges" ? "rotate-180" : ""}`}
										/>
									</div>
								</div>
								<div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
									<div
										className="h-full rounded-full bg-emerald-500 transition-all"
										style={{ width: `${pctBridges}%` }}
									/>
								</div>
							</button>

							{/* LEVEL 2: Bridge Assets (grouped by symbol) */}
							<div className={`grid transition-all duration-300 ${expandedCategory === "bridges" ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
								<div className="overflow-hidden">
									<div className="flex flex-col gap-1 pl-5 pt-1">
										{bridgeGroups.map((group) => {
											const isExpanded = expandedBridgeSymbol === group.symbol;
											const pctOfTotal = totalSupply > 0 ? (group.totalMinted / totalSupply) * 100 : 0;

											return (
												<div key={group.symbol}>
													<button
														onClick={() => setExpandedBridgeSymbol(isExpanded ? null : group.symbol)}
														aria-expanded={isExpanded}
														className="w-full flex flex-col gap-1.5 p-2 rounded-lg hover:bg-layout-primary transition-colors"
													>
														<div className="w-full flex items-center justify-between">
															<div className="flex items-center gap-2">
																<TokenLogo currency={group.symbol} size={6} />
																<span className="font-semibold">{group.symbol}</span>
															</div>
															<div className="flex items-center gap-2">
																<span className="text-text-muted">
																	{formatCurrency(group.totalMinted, 0, 0)} {TOKEN_SYMBOL} ({pctOfTotal.toFixed(1)}%)
																</span>
																<FontAwesomeIcon
																	icon={faChevronDown}
																	className={`w-3 h-3 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
																/>
															</div>
														</div>
														<div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
															<div
																className="h-full rounded-full bg-emerald-500 transition-all"
																style={{ width: `${pctOfTotal}%` }}
															/>
														</div>
													</button>

													{/* LEVEL 3: Individual Bridge Contracts */}
													<div className={`grid transition-all duration-300 ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
														<div className="overflow-hidden">
															<div className="flex flex-col gap-1 pl-5 pb-1">
																{group.items.map((bridge) => {
																	const minted = parseFloat(formatUnits(bridge.minted, 18));
																	const pctBridge = totalSupply > 0 ? (minted / totalSupply) * 100 : 0;
																	return (
																		<a
																			key={bridge.bridgeAddress}
																			href={`${explorerUrl}/address/${bridge.bridgeAddress}`}
																			target="_blank"
																			rel="noopener noreferrer"
																			className="flex flex-col gap-1 p-2 rounded-lg hover:bg-layout-primary transition-colors text-sm"
																		>
																			<div className="flex items-center justify-between">
																				<span className="text-link hover:underline">
																					{shortenAddress(bridge.bridgeAddress)}
																				</span>
																				<span className="text-text-muted">
																					{formatCurrency(minted, 0, 0)} {TOKEN_SYMBOL} ({pctBridge.toFixed(1)}%)
																				</span>
																			</div>
																			<div className="w-full h-1 rounded-full bg-slate-200 overflow-hidden">
																				<div
																					className="h-full rounded-full bg-emerald-400 transition-all"
																					style={{ width: `${pctBridge}%` }}
																				/>
																			</div>
																		</a>
																	);
																})}
															</div>
														</div>
													</div>
												</div>
											);
										})}
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</AppCard>
	);
}
