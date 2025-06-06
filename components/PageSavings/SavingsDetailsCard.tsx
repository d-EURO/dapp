import AppCard from "@components/AppCard";
import { formatCurrency, TOKEN_SYMBOL } from "@utils";
import { formatUnits } from "viem";
import { useTranslation } from "next-i18next";
interface Props {
	balance: bigint;
	change: bigint;
	direction: boolean;
	interest: bigint;
	locktime: bigint;
}

export default function SavingsDetailsCard({ balance, change, direction, interest, locktime }: Props) {
	const { t } = useTranslation();

	return (
		<AppCard>
			<div className="text-lg font-bold text-center">{t("savings.outcome")}</div>
			<div className="p-4 flex flex-col gap-2">
				<div className="flex">
					<div className="flex-1">{t("savings.current_balance")}</div>
					<div className="">{formatCurrency(formatUnits(balance, 18))} {TOKEN_SYMBOL}</div>
				</div>
				<div className="flex">
					<div className="flex-1">{direction ? t("savings.to_be_added_from_your_wallet") : t("savings.withdrawn_to_your_wallet")}</div>
					<div className="">{formatCurrency(formatUnits(change, 18))} {TOKEN_SYMBOL}</div>
				</div>
				<div className="flex">
					<div className="flex-1">{t("savings.interest_to_be_collected")}</div>
					<div className="">{formatCurrency(formatUnits(interest, 18))} {TOKEN_SYMBOL}</div>
				</div>
				<hr className="border-slate-700 border-dashed" />
				<div className="flex font-bold">
					<div className="flex-1">{t("savings.resulting_balance")}</div>
					<div className="">{formatCurrency(formatUnits(balance + change + interest, 18))} {TOKEN_SYMBOL}</div>
				</div>

				<div className="flex mt-8">
					<div className={`flex-1`}>
						{t("savings.when_saving_additional_funds_your_balance_will_be_locked")}
						<span className="font-semibold">
							{locktime > 0
								? `${t("savings.your_funds_are_still_locked_for", { hours: formatCurrency(
										(parseFloat(locktime.toString()) / 60 / 60).toString()
								  )})}`
								: ""}
						</span>
					</div>
				</div>
			</div>
		</AppCard>
	);
}
