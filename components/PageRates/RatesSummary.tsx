import { useSelector } from "react-redux";
import { RootState } from "../../redux/redux.store";
import { ADDRESS, ERC20ABI } from "@deuro/eurocoin";
import { useChainId, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import AppCard from "../AppCard";
import AppBox from "../AppBox";
import DisplayLabel from "../DisplayLabel";
import DisplayAmount from "../DisplayAmount";
import { SectionTitle } from "../SectionTitle";
import { formatCurrency } from "../../utils/format";
import { TOKEN_SYMBOL } from "@utils";
import { useTranslation } from "next-i18next";

export default function RatesSummary() {
	const { t } = useTranslation();
	const eco = useSelector((state: RootState) => state.ecosystem);
	const savingsInfo = useSelector((state: RootState) => state.savings.savingsInfo);
	const chainId = useChainId();

	const { data: totalSavingsRaw = 0n } = useReadContract({
		address: ADDRESS[chainId].decentralizedEURO,
		abi: ERC20ABI,
		functionName: "balanceOf",
		args: [ADDRESS[chainId].savingsGateway],
	});

	const exposures = eco.exposureData?.exposures ?? [];
	const totalOpenPositions = exposures.reduce((sum, e) => sum + e.positions.open, 0);
	const totalMinted = exposures.reduce((sum, e) => sum + e.mint.totalMinted, 0);
	const loanInterestPA = eco.exposureData?.general?.earningsPerAnnum ?? 0;

	const savingsRate = savingsInfo ? savingsInfo.rate / 10_000 : 0;
	const totalSavingsNum = parseFloat(formatUnits(totalSavingsRaw, 18));
	const savingsInterestPA = totalSavingsNum * savingsRate / 100;
	const netInterest = loanInterestPA - savingsInterestPA;

	if (!eco.loaded || !savingsInfo) {
		return (
			<AppCard>
				<SectionTitle>{t("rates.title")}</SectionTitle>
				<p className="text-text-muted">{t("common.loading")}</p>
			</AppCard>
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
