import Link from "next/link";
import { shortenHash, transactionLink } from "@utils";
import { Hash } from "viem";
import { WAGMI_CHAIN } from "../app.config";
import { useTranslation } from "react-i18next";

export const renderErrorToast = (error: string | string[], t?: any) => {
	error = typeof error == "string" ? [error] : error;
	const title = t ? t("common.txs.failed") : "Transaction Failed";
	return (
		<TxToast
			title={title}
			rows={error.map((e) => {
				return { title: e };
			})}
		/>
	);
};

export const renderErrorTxToast = (error: any, t?: any) => {
	const errorLines: string[] = error.message.split("\n");
	return renderErrorTxStackToast(error, 2, t);
};
export const renderErrorTxStackToast = (error: any, limit: number, t?: any) => {
	const errorLines: string[] = error.message.split("\n");
	const title = t ? t("common.txs.failed") : "Transaction Failed";
	return (
		<TxToast
			title={title}
			rows={errorLines.slice(0, limit == 0 ? errorLines.length : limit).map((line) => {
				return {
					title: "",
					value: line,
				};
			})}
		/>
	);
};

export type TxToastRowType = { title: string; value?: string | JSX.Element; hash?: Hash };

export const TxToast = (props: { title: string; rows: TxToastRowType[]; success?: boolean }) => {
	const { title, rows, success = true } = props;
	const chain = WAGMI_CHAIN;
	let reasonLine: number;

	return (
		<div className="flex flex-col text-text-primary">
			<div className="font-bold mb-2">{title}</div>
			{rows.map((row, i) => {
				if (row.value?.toString().includes("with the following reason")) reasonLine = i + 1;
				return (
					<div className="flex items-center gap-1 justify-between text-sm" style={{ minHeight: 8 }} key={row.title + i}>
						{row.title && <div>{row.title}</div>}
						{row.hash ? (
							<Link
								href={transactionLink(chain?.blockExplorers?.default.url, row.hash)}
								target="_blank"
								className="text-link"
							>
								{shortenHash(row.hash)}
							</Link>
						) : (
							<div className={i == reasonLine ? "font-bold uppercase" : ""}>{row.value}</div>
						)}
					</div>
				);
			})}
		</div>
	);
};
