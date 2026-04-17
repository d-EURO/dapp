import { ContractUrl, shortenAddress, formatCurrency } from "@utils";
import Table from "../Table";
import TableBody from "../Table/TableBody";
import TableHeader from "../Table/TableHead";
import TableRow from "../Table/TableRow";
import TableRowEmpty from "../Table/TableRowEmpty";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUpRightFromSquare, faMinus, faPlus } from "@fortawesome/free-solid-svg-icons";
import { useState, useMemo } from "react";
import { TableShowMoreRow } from "@components/Table/TableShowMoreRow";
import { SectionTitle } from "@components/SectionTitle";
import { useTranslation } from "next-i18next";
import { useSelector } from "react-redux";
import { RootState } from "../../redux/redux.store";
import { gql, useQuery } from "@apollo/client";
import { formatUnits } from "viem";

interface ReferralData {
	volume: string;
	interest: string;
	interestPaid: string;
	bonus: string;
	address: string;
}

interface FrontendRewardsItem {
	referred: string;
	volume: string;
	timestamp: number;
}

export default function YourReferralsTable() {
	const { t } = useTranslation();

	const headers = useMemo(
		() => [
			t("referrals.current_savings_balance"),
			t("referrals.total_interest_received"),
			t("referrals.total_interest_paid"),
			t("referrals.referral_bonus"),
			t("referrals.address"),
		],
		[t]
	);

	const [isShowMore, setIsShowMore] = useState(false);
	const [tab, setTab] = useState<string>(headers[0]);
	const [reverse, setReverse] = useState<boolean>(false);
	const myFrontendCode = useSelector((state: RootState) => state.myReferrals.myFrontendCode);
	const savingsLeaderboard = useSelector((state: RootState) => state.savings.savingsLeaderboard);

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
			setReverse(e === headers[1]);
			setTab(e);
		}
	};

	const savingsMap = useMemo(
		() => new Map((savingsLeaderboard || []).map((item) => [item.account.toLowerCase(), item])),
		[savingsLeaderboard]
	);

	const data: ReferralData[] = useMemo(() => {
		const referralVolume = (referralData?.frontendRewardsVolumeMappings?.items as FrontendRewardsItem[] | undefined) || [];

		return referralVolume.map((item: FrontendRewardsItem) => {
			const bonusAmount = BigInt(item.volume);
			const savingsEntry = savingsMap.get(item.referred.toLowerCase());
			const savingsAmount = savingsEntry?.amountSaved || "0";
			const historicalInterest = BigInt(savingsEntry?.interestReceived || "0");
			const currentAccruedInterest = BigInt(savingsEntry?.unrealizedInterest || "0");
			const totalInterest = historicalInterest + currentAccruedInterest;

			return {
				volume: savingsAmount,
				interest: totalInterest.toString(),
				interestPaid: historicalInterest.toString(),
				bonus: bonusAmount.toString(),
				address: item.referred,
			};
		});
	}, [referralData, savingsMap]);

	const sortedData = useMemo(() => sortReferralVolume({ referralVolume: data, headers, tab, reverse }), [data, headers, tab, reverse]);

	return (
		<div className="flex flex-col gap-2 sm:gap-0">
			<SectionTitle>{t("referrals.your_referrals")}</SectionTitle>
			<Table>
				<TableHeader 
					headers={headers} 
					tab={tab} 
					tabOnChange={handleTabOnChange} 
					reverse={reverse}
					colSpan={5}
					headerClassNames={["text-left", "text-right", "text-right", "text-right", "text-right"]}
				/>
				<TableBody>
					<>
						{sortedData.length === 0 ? (
							<TableRowEmpty>{t("referrals.no_referrals_yet")}</TableRowEmpty>
						) : (
							sortedData.slice(0, isShowMore ? sortedData.length : 3).map((row, i) => (
								<TableRow key={i} headers={headers} tab={tab} colSpan={5}>
									<div className="text-base sm:font-medium leading-tight text-left">
										{formatCurrency(formatUnits(BigInt(row.volume), 18), 0, 5)}
									</div>
									<div className="text-base sm:font-medium leading-tight">
										{formatCurrency(formatUnits(BigInt(row.interest), 18), 0, 5)}
									</div>
									<div className="text-base sm:font-medium leading-tight">
										{formatCurrency(formatUnits(BigInt(row.interestPaid), 18), 0, 5)}
									</div>
									<div className="text-base sm:font-medium leading-tight">
										{formatCurrency(formatUnits(BigInt(row.bonus), 18), 0, 5)}
									</div>
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
						{sortedData.length > 3 && (
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

function sortReferralVolume(params: { referralVolume: ReferralData[]; headers: string[]; tab: string; reverse: boolean }): ReferralData[] {
	const { referralVolume, headers, tab, reverse } = params;

	const sorted = [...referralVolume];

	if (tab === headers[0]) {
		sorted.sort((a, b) => Number(b.volume) - Number(a.volume));
	} else if (tab === headers[1]) {
		sorted.sort((a, b) => Number(b.interest) - Number(a.interest));
	} else if (tab === headers[2]) {
		sorted.sort((a, b) => Number(b.interestPaid) - Number(a.interestPaid));
	} else if (tab === headers[3]) {
		sorted.sort((a, b) => Number(b.bonus) - Number(a.bonus));
	} else if (tab === headers[4]) {
		sorted.sort((a, b) => a.address.localeCompare(b.address));
	}

	return reverse ? sorted.reverse() : sorted;
}
