import { SecondaryButton, SecondaryLinkButton } from "@components/Button";
import TokenLogo from "@components/TokenLogo";
import { useTranslation } from "next-i18next";
import { Fragment } from "react";
import { HeaderCell, NoDataRow } from "./SectionTable";
import { useAccount } from "wagmi";
import { RootState } from "../../redux/redux.store";
import { useSelector } from "react-redux";
import { Address, formatUnits, zeroAddress } from "viem";
import { formatCurrency, TOKEN_SYMBOL } from "@utils";
import { useRouter } from "next/router";
import { getPublicViewAddress } from "../../utils/url";
interface BorrowData {
	position: `0x${string}`;
	symbol: string;
	collateralAmount: string;
	collateralization: string;
	loanDueIn: string;
	amountBorrowed: string;
}

const DesktopTable = ({ borrowData }: { borrowData: BorrowData[] }) => {
	const { t } = useTranslation();

	const isBorrowData = borrowData.length > 0;

	return (
		<div className="w-full hidden sm:grid grid-cols-[auto_1fr_1fr_1fr_1fr_auto] items-center">
			{/** Headers */}
			<div></div>
			<HeaderCell>{t("dashboard.collateral")}</HeaderCell>
			<HeaderCell>{t("dashboard.collateralization")}</HeaderCell>
			<HeaderCell>{t("dashboard.loan_due_in")}</HeaderCell>
			<HeaderCell>{t("dashboard.amount_borrowed")}</HeaderCell>
			<div className="text-center"></div>

			{/** Rows */}
			{isBorrowData ? (
				borrowData.map((item) => (
					<Fragment key={item.position}>
						<div className="flex pr-3 items-center justify-center">
							<TokenLogo currency={item.symbol} size={8} />
						</div>
						<div className="font-medium text-base leading-tight">
							{item.collateralAmount} {item.symbol}
						</div>
						<div className="font-medium text-base leading-tight">
							{item.collateralization === "Infinity" ? "∞" : item.collateralization} %
						</div>
						<div className="font-medium text-base leading-tight">
							{item.loanDueIn} {t("common.days")}
						</div>
						<div className="font-extrabold text-base leading-tight">
							{item.amountBorrowed} {TOKEN_SYMBOL}
						</div>
						<div className="py-3 flex items-center justify-end">
							<SecondaryLinkButton className="flex min-w-32 w-full py-2.5 px-4" href={`/mint/${item.position}/manage`}>
								{t("dashboard.manage")}
							</SecondaryLinkButton>
						</div>
					</Fragment>
				))
			) : (
				<NoDataRow className="mt-1.5 col-span-5">{t("dashboard.no_borrowings_yet")}</NoDataRow>
			)}
		</div>
	);
};

const MobileTable = ({ borrowData }: { borrowData: BorrowData[] }) => {
	const { t } = useTranslation();

	const isBorrowData = borrowData.length > 0;

	return (
		<div className="block sm:hidden w-full flex flex-col items-center gap-6">
			{isBorrowData ? (
				<>
					{borrowData.map((item) => (
						<div className="w-full flex flex-col gap-1 border-b border-borders-dividerLight" key={item.position}>
							<div className="mb-2 w-full flex flex-col justify-start items-start gap-1">
								<div className="text-text-muted2 text-xs font-medium leading-[1.125rem]">Collateral</div>
								<div className="flex flex-row items-center gap-2">
									<div className="flex items-center justify-center">
										<TokenLogo currency={item.symbol} size={8} />
									</div>
									<div className="font-medium text-base leading-tight">
										{item.collateralAmount} {item.symbol}
									</div>
								</div>
							</div>

							<div className="w-full flex flex-row justify-between items-center">
								<div className="text-text-muted2 text-xs font-medium leading-[1.125rem]">Collateralization</div>
								<div className="font-medium text-base leading-tight">{item.collateralization} %</div>
							</div>

							<div className="w-full flex flex-row justify-between items-center">
								<div className="text-text-muted2 text-xs font-medium leading-[1.125rem]">Loan due in</div>
								<div className="font-medium text-base leading-tight">
									{item.loanDueIn} {t("common.days")}
								</div>
							</div>

							<div className="w-full flex flex-row justify-between items-center">
								<div className="text-text-muted2 text-xs font-medium leading-[1.125rem]">Amount borrowed</div>
								<div className="font-extrabold text-base leading-tight">
									{item.amountBorrowed} {TOKEN_SYMBOL}
								</div>
							</div>

							<SecondaryLinkButton className="flex w-full mt-2 mb-4 py-1 px-3" href={`/mint/${item.position}/manage`}>
								{t("dashboard.manage")}
							</SecondaryLinkButton>
						</div>
					))}
				</>
			) : (
				<NoDataRow className="col-span-5">{t("dashboard.no_borrowings_yet")}</NoDataRow>
			)}
		</div>
	);
};

export const MyBorrow = () => {
	const positions = useSelector((state: RootState) => state.positions.list.list);
	const prices = useSelector((state: RootState) => state.prices.coingecko);
	const { address } = useAccount();
	const router = useRouter();
	const { t } = useTranslation();

	const overwrite = getPublicViewAddress(router);
	const account = overwrite || address || zeroAddress;

	const ownedPositions = positions.filter((position) => position.owner === account).filter((position) => !position.closed);

	const borrowData = ownedPositions.map((position) => {
		const { principal, reserveContribution, collateralBalance, collateralDecimals, collateralSymbol } = position;
		const amountBorrowed = formatCurrency(
			formatUnits(BigInt(principal) - (BigInt(principal) * BigInt(reserveContribution)) / 1_000_000n, position.deuroDecimals)
		) as string;

		const collTokenPrice = prices[position.collateral.toLowerCase() as Address]?.price?.usd || 0;
		const deuroPrice = prices[position.deuro.toLowerCase() as Address]?.price?.usd || 1;
		const balance: number = Math.round((parseInt(position.collateralBalance) / 10 ** position.collateralDecimals) * 100) / 100;
		const balanceDEURO: number = Math.round(((balance * collTokenPrice) / deuroPrice) * 100) / 100;
		const liquidationDEURO: number = Math.round((parseInt(position.price) / 10 ** (36 - position.collateralDecimals)) * 100) / 100;
		const liquidationPct: number = Math.round((balanceDEURO / (liquidationDEURO * balance)) * 10000) / 100;

		return {
			position: position.position as `0x${string}`,
			symbol: collateralSymbol,
			collateralAmount: formatUnits(BigInt(collateralBalance), collateralDecimals) as string,
			collateralization: liquidationPct.toString(),
			loanDueIn: formatCurrency(Math.round((position.expiration * 1000 - Date.now()) / 1000 / 60 / 60 / 24)) as string,
			amountBorrowed,
		};
	});

	const totalOwed = ownedPositions.reduce(
		(acc, curr) => acc + BigInt(curr.principal) - (BigInt(curr.principal) * BigInt(curr.reserveContribution)) / 1_000_000n,
		0n
	);

	return (
		<div className="w-full h-full p-4 sm:p-8 flex flex-col items-start">
			<div className="pb-7 items-center justify-start flex gap-2">
				<span className="text-text-primary text-2xl font-black">{t("dashboard.my_borrow")}</span>
			</div>
			<div className="w-full flex flex-row justify-between items-center">
				<DesktopTable borrowData={borrowData} />
				<MobileTable borrowData={borrowData} />
			</div>
			<div className="w-full pt-5 flex-1 flex items-end">
				<div className="flex flex-row items-center w-full">
					<span className="text-text-primary pr-4 text-base font-extrabold leading-[1.25rem]">{t("dashboard.total_owed")}</span>
					<span className="text-text-primary text-base font-medium leading-[1.25rem]">
						{formatCurrency(formatUnits(totalOwed, 18)) as string} {TOKEN_SYMBOL}
					</span>
				</div>
			</div>
		</div>
	);
};
