import { ContractUrl, shortenAddress, formatCurrency } from "@utils";
import Table from "../Table";
import TableBody from "../Table/TableBody";
import TableHeader from "../Table/TableHead";
import TableRow from "../Table/TableRow";
import TableRowEmpty from "../Table/TableRowEmpty";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUpRightFromSquare, faMinus, faPlus } from "@fortawesome/free-solid-svg-icons";
import { useState } from "react";
import { TableShowMoreRow } from "@components/Table/TableShowMoreRow";
import { SectionTitle } from "@components/SectionTitle";
import { useTranslation } from "next-i18next";
import { useSelector } from "react-redux";
import { RootState } from "../../redux/redux.store";
import { gql, useQuery } from "@apollo/client";
import { formatUnits } from "viem";
interface ReferralData {
	volume: string;
	date: string;
	address: string;
}

const subHeaders = ["dEURO", "", ""];

export default function YourReferralsTable() {
	const { t } = useTranslation();
	const headers = [t("referrals.referral_volume"), t("referrals.date"), t("referrals.address")];
	const [isShowMore, setIsShowMore] = useState(false);
	const [tab, setTab] = useState<string>(headers[0]);
	const [reverse, setReverse] = useState<boolean>(false);

	const myFrontendCode = useSelector((state: RootState) => state.myReferrals.myFrontendCode);

	const { data: referralData } = useQuery(
		gql`
			query {
				frontendRewardsVolumeMappings(
					where: { frontendCode: "${myFrontendCode}" }
				) {
					items {
						referred
						volume
						timestamp
					}
				}
			}
		`,
		{
			pollInterval: 0,
			skip: !myFrontendCode,
		}
	);

	const handleTabOnChange = function (e: string) {
		if (tab === e) {
			setReverse(!reverse);
		} else {
			if (e === headers[1]) setReverse(true);
			else setReverse(false);

			setTab(e);
		}
	};

	const referralVolume = referralData?.frontendRewardsVolumeMappings?.items || [];
	const data: ReferralData[] = referralVolume.map((item: any) => {
		const dateArr: string[] = new Date(item.timestamp * 1000).toDateString().split(" ");
		const dateStr: string = `${dateArr[2]} ${dateArr[1]} ${dateArr[3]}`;
		return {
			volume: item.volume,
			date: dateStr,
			address: item.referred,
		}
	});

	return (
		<div className="flex flex-col gap-2 sm:gap-0">
			<SectionTitle>{t("referrals.your_referrals")}</SectionTitle>
			<Table>
				<TableHeader headers={headers} subHeaders={subHeaders} tab={tab} tabOnChange={handleTabOnChange} reverse={reverse} />
				<TableBody>
					<>
						{data.length === 0 ? (
							<TableRowEmpty>{t("referrals.no_referrals_yet")}</TableRowEmpty>
						) : (
							data.slice(0, isShowMore ? data.length : 3).map((row, i) => (
								<TableRow key={i} headers={headers} tab={tab}>
									<div className="text-base sm:font-medium leading-tight text-left">{formatCurrency(formatUnits(BigInt(row.volume), 18))}</div>
									<div className="text-base sm:font-medium leading-tight">{row.date}</div>
									<div>
										<Link
											href={ContractUrl(row.address as `0x${string}`)}
											className="text-base sm:font-medium leading-tight"
										>
											<span>{shortenAddress(row.address as `0x${string}`)}</span>
											<FontAwesomeIcon icon={faArrowUpRightFromSquare} className="w-3 ml-2" />
										</Link>
									</div>
								</TableRow>
							))
						)}
						{data.length > 3 && (
							<TableShowMoreRow onShowMoreClick={() => setIsShowMore(!isShowMore)}>
								<div className="text-table-header-active text-base font-black leading-normal tracking-tight">
									{isShowMore ? t("referrals.show_less") : t("referrals.show_more")}
								</div>
								<div className="justify-start items-center gap-2.5 flex">
									<FontAwesomeIcon icon={isShowMore ? faMinus : faPlus} className="w-4 h-4 text-table-header-active" />
								</div>
							</TableShowMoreRow>
						)}
					</>
				</TableBody>
			</Table>
		</div>
	);
}
