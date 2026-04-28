import TableRow from "../Table/TableRow";
import TokenLogo from "../TokenLogo";
import { BridgeStat } from "@hooks";
import { useContractUrl } from "@hooks";
import { TOKEN_SYMBOL, formatCurrency } from "@utils";
import { formatUnits } from "viem";
import { useTranslation } from "next-i18next";

interface Props {
	headers: string[];
	bridge: BridgeStat;
	tab: string;
}

function formatAmount(value: bigint): string {
	const num = parseFloat(formatUnits(value, 18));
	if (num < 1 && num > 0) return "0";
	return formatCurrency(Math.round(num), 0, 0) ?? "0";
}

export default function GovernanceBridgesRow({ headers, bridge, tab }: Props) {
	const { t } = useTranslation();
	const url = useContractUrl(bridge.bridgeAddress);

	const minted = bridge.minted;
	const limit = bridge.limit;
	const utilization = limit > 0n ? Number((minted * 10000n) / limit) / 100 : 0;
	const remaining = limit > minted ? limit - minted : 0n;

	const horizonDate = bridge.horizon > 0n ? new Date(Number(bridge.horizon) * 1000) : null;
	const daysUntilExpiry = horizonDate ? Math.round((horizonDate.getTime() - Date.now()) / 1000 / 60 / 60 / 24) : null;

	return (
		<TableRow headers={headers} tab={tab}>
			<div className="flex items-center gap-2">
				<TokenLogo currency={bridge.symbol} size={6} />
				<div className="flex flex-col">
					<a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
						{bridge.symbol}
					</a>
				</div>
			</div>

			<div className="flex flex-col">
				<span>
					{formatAmount(minted)} {TOKEN_SYMBOL}
				</span>
				<span className="text-sm text-text-subheader">
					{t("governance.limit")}: {formatAmount(limit)} {TOKEN_SYMBOL}
				</span>
			</div>

			<div className="flex flex-col items-end gap-1">
				<span className={utilization > 90 ? "text-red-500 font-bold" : utilization > 70 ? "text-yellow-500" : ""}>
					{utilization.toFixed(1)}%
				</span>
				<div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
					<div
						className={`h-full rounded-full ${
							utilization > 90 ? "bg-red-500" : utilization > 70 ? "bg-yellow-500" : "bg-emerald-500"
						}`}
						style={{ width: `${Math.min(utilization, 100)}%` }}
					/>
				</div>
				<span className="text-sm text-text-subheader">
					{formatAmount(remaining)} {t("governance.available")}
				</span>
			</div>

			<div className="flex flex-col">
				{horizonDate ? (
					<>
						<span>{horizonDate.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</span>
						<span className="text-sm text-text-subheader">
							{daysUntilExpiry !== null ? `${daysUntilExpiry} ${t("governance.days_left")}` : ""}
						</span>
					</>
				) : (
					<span className="text-text-subheader">-</span>
				)}
			</div>
		</TableRow>
	);
}
