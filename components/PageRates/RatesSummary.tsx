import { useSelector } from "react-redux";
import { RootState } from "../../redux/redux.store";
import AppCard from "../AppCard";
import AppBox from "../AppBox";
import DisplayLabel from "../DisplayLabel";
import DisplayAmount from "../DisplayAmount";
import { SectionTitle } from "../SectionTitle";
import { formatCurrency, TOKEN_SYMBOL } from "@utils";
import { useTranslation } from "next-i18next";
import { erc20Abi, formatUnits } from "viem";
import { useChainId, useReadContracts } from "wagmi";
import { getAppAddresses, isDeployed } from "@contracts";

export default function RatesSummary() {
	const { t } = useTranslation();
	const eco = useSelector((state: RootState) => state.ecosystem);
	const savingsInfo = useSelector((state: RootState) => state.savings.savingsInfo);
	const chainId = useChainId();
	const ADDR = getAppAddresses(chainId);

	const exposures = eco.exposureData?.exposures ?? [];
	const totalOpenPositions = exposures.reduce((sum, e) => sum + e.positions.open, 0);
	const totalMinted = exposures.reduce((sum, e) => sum + e.mint.totalMinted, 0);
	const loanInterestPA = eco.exposureData?.general?.earningsPerAnnum ?? 0;

	const { data: savingsBalances } = useReadContracts({
		contracts: [
			{
				address: ADDR.decentralizedEURO,
				abi: erc20Abi,
				functionName: "balanceOf",
				args: [ADDR.savingsGateway],
			},
			...(isDeployed(ADDR.savings)
				? [
						{
							address: ADDR.decentralizedEURO,
							abi: erc20Abi,
							functionName: "balanceOf",
							args: [ADDR.savings],
						},
				  ]
				: []),
		],
	});

	const v2SavingsRaw = (savingsBalances?.[0]?.result as bigint | undefined) ?? 0n;
	const v3SavingsRaw = isDeployed(ADDR.savings) ? ((savingsBalances?.[1]?.result as bigint | undefined) ?? 0n) : 0n;
	const v2SavingsNum = parseFloat(formatUnits(v2SavingsRaw, 18));
	const v3SavingsNum = parseFloat(formatUnits(v3SavingsRaw, 18));
	const v2SavingsRate = (savingsInfo?.rateV2 ?? 0) / 10_000;
	const v3SavingsRate = (savingsInfo?.rateV3 ?? savingsInfo?.rate ?? 0) / 10_000;
	const hasSavingsBalances = Boolean(savingsBalances?.length);
	const totalSavingsNum = hasSavingsBalances ? v2SavingsNum + v3SavingsNum : savingsInfo?.totalBalance || 0;
	const savingsInterestPA = hasSavingsBalances
		? (v2SavingsNum * v2SavingsRate) / 100 + (v3SavingsNum * v3SavingsRate) / 100
		: (totalSavingsNum * ((savingsInfo?.rate ?? 0) / 10_000)) / 100;
	const savingsRate = totalSavingsNum > 0 ? (savingsInterestPA / totalSavingsNum) * 100 : v3SavingsRate || v2SavingsRate;
	const netInterest = loanInterestPA - savingsInterestPA;

	if (!eco.loaded || !savingsInfo) {
		return (
			<div>
				<SectionTitle>{t("rates.title")}</SectionTitle>
				<p className="text-text-muted">{t("common.loading")}</p>
			</div>
		);
	}

	return (
		<div>
			<SectionTitle>{t("rates.title")}</SectionTitle>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{/* Revenue: Loan Interest */}
				<AppCard>
					<div className="text-lg font-bold mb-2">{t("rates.loan_interest")}</div>
					<div className="flex flex-col gap-2">
						<AppBox>
							<DisplayLabel label={t("rates.open_positions")} />
							<div className="mt-1 text-base font-semibold">{formatCurrency(totalOpenPositions, 0, 0)}</div>
						</AppBox>
						<AppBox>
							<DisplayLabel label={t("rates.total_minted")} />
							<DisplayAmount className="mt-1" amount={totalMinted} currency={TOKEN_SYMBOL} hideLogo />
						</AppBox>
						<AppBox>
							<DisplayLabel label={t("rates.interest_pa")} />
							<DisplayAmount className="mt-1" amount={loanInterestPA} currency={TOKEN_SYMBOL} hideLogo />
						</AppBox>
					</div>
				</AppCard>

				{/* Expenses: Savings Interest */}
				<AppCard>
					<div className="text-lg font-bold mb-2">{t("rates.savings_interest")}</div>
					<div className="flex flex-col gap-2">
						<AppBox>
							<DisplayLabel label={t("rates.total_savings_balance")} />
							<DisplayAmount className="mt-1" amount={totalSavingsNum} currency={TOKEN_SYMBOL} hideLogo />
						</AppBox>
						<AppBox>
							<DisplayLabel label={t("rates.savings_rate")} />
							<DisplayAmount className="mt-1" amount={savingsRate} currency="%" hideLogo />
						</AppBox>
						<AppBox>
							<DisplayLabel label={t("rates.estimated_interest_pa")} />
							<DisplayAmount className="mt-1" amount={savingsInterestPA} currency={TOKEN_SYMBOL} hideLogo />
						</AppBox>
					</div>
				</AppCard>
			</div>

			{/* Net Interest */}
			<AppCard className="mt-4 p-4">
				<div className="flex items-center justify-between">
					<span className="text-base font-bold">{t("rates.net_interest_pa")}</span>
					<span className={`text-lg font-bold ${netInterest >= 0 ? "text-green-600" : "text-red-600"}`}>
						{formatCurrency(netInterest, 0, 0)} {TOKEN_SYMBOL}
					</span>
				</div>
			</AppCard>
		</div>
	);
}
