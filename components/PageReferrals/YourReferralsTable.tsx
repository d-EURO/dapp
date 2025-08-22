import { ContractUrl, shortenAddress, formatCurrency } from "@utils";
import Table from "../Table";
import TableBody from "../Table/TableBody";
import TableRowEmpty from "../Table/TableRowEmpty";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUpRightFromSquare, faMinus, faPlus, faArrowDownWideShort, faArrowUpShortWide } from "@fortawesome/free-solid-svg-icons";
import SortBySelect from "@components/Input/SortBySelect";
import { useState, useEffect } from "react";
import { TableShowMoreRow } from "@components/Table/TableShowMoreRow";
import { SectionTitle } from "@components/SectionTitle";
import { useTranslation } from "next-i18next";
import { useSelector } from "react-redux";
import { RootState } from "../../redux/redux.store";
import { gql, useQuery } from "@apollo/client";
import { formatUnits } from "viem";
import { useChainId } from "wagmi";
import { ADDRESS, SavingsGatewayABI } from "@deuro/eurocoin";
import { readContract } from "wagmi/actions";
import { WAGMI_CONFIG } from "../../app.config";
interface ReferralData {
	volume: string;
	interest: string;
	interestPaid: string;
	bonus: string;
	date: string;
	address: string;
}

const subHeaders = ["dEURO", "dEURO", "dEURO", "dEURO", ""];

export default function YourReferralsTable() {
	const { t } = useTranslation();
	const headers = [t("referrals.current_savings_balance"), t("referrals.total_interest_received"), t("referrals.total_interest_paid"), t("referrals.referral_bonus"), t("referrals.address")];
	const [isShowMore, setIsShowMore] = useState(false);
	const [tab, setTab] = useState<string>(headers[0]);
	const [reverse, setReverse] = useState<boolean>(false);
	const [accruedInterests, setAccruedInterests] = useState<Map<string, bigint>>(new Map());

	const chainId = useChainId();
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

	// Get unique addresses from referral data
	const referredAddresses = referralData?.frontendRewardsVolumeMappings?.items?.map((item: any) => 
		item.referred.toLowerCase()
	) || [];

	// Fetch accrued interest for each address
	useEffect(() => {
		const fetchAccruedInterests = async () => {
			if (referredAddresses.length === 0) return;
			
			const interests = new Map<string, bigint>();
			
			for (const address of referredAddresses) {
				try {
					const accruedInterest = await readContract(WAGMI_CONFIG, {
						address: ADDRESS[chainId].savingsGateway,
						abi: SavingsGatewayABI,
						functionName: "accruedInterest",
						args: [address as `0x${string}`],
					});
					interests.set(address, accruedInterest);
				} catch (error) {
					console.error(`Failed to fetch accrued interest for ${address}:`, error);
					interests.set(address, 0n);
				}
			}
			
			setAccruedInterests(interests);
		};
		
		fetchAccruedInterests();
	}, [referredAddresses.join(','), chainId]);
	
	// Query savings data for all referred addresses
	const { data: savingsData } = useQuery(
		gql`
			query {
				savingsSavedMappings(
					where: { id_in: ${JSON.stringify(referredAddresses)} }
				) {
					items {
						id
						amount
					}
				}
			}
		`,
		{
			pollInterval: 0,
			skip: !myFrontendCode || referredAddresses.length === 0,
		}
	);

	// Query interest data for all referred addresses
	const { data: interestData } = useQuery(
		gql`
			query {
				savingsInterestMappings(
					where: { id_in: ${JSON.stringify(referredAddresses)} }
				) {
					items {
						id
						amount
					}
				}
			}
		`,
		{
			pollInterval: 0,
			skip: !myFrontendCode || referredAddresses.length === 0,
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
	const savingsMap = new Map(
		savingsData?.savingsSavedMappings?.items?.map((item: any) => [
			item.id.toLowerCase(),
			item.amount
		]) || []
	);
	
	const interestMap = new Map(
		interestData?.savingsInterestMappings?.items?.map((item: any) => [
			item.id.toLowerCase(),
			item.amount
		]) || []
	);
	
	const data: ReferralData[] = referralVolume.map((item: any) => {
		const dateArr: string[] = new Date(item.timestamp * 1000).toDateString().split(" ");
		const dateStr: string = `${dateArr[2]} ${dateArr[1]} ${dateArr[3]}`;
		const bonusAmount = BigInt(item.volume);
		
		// Get savings amount and interest for this address
		const savingsAmount = savingsMap.get(item.referred.toLowerCase()) || "0";
		const historicalInterest = BigInt(interestMap.get(item.referred.toLowerCase()) || "0");
		const currentAccruedInterest = accruedInterests.get(item.referred.toLowerCase()) || 0n;
		
		// Combine historical interest with current accrued interest
		const totalInterest = historicalInterest + currentAccruedInterest;
		
		return {
			volume: savingsAmount,
			interest: totalInterest.toString(),
			interestPaid: historicalInterest.toString(),
			bonus: bonusAmount.toString(),
			date: dateStr,
			address: item.referred,
		}
	});

	const sortedData = sortReferralVolume({ referralVolume: [...data], headers, tab, reverse });

	return (
		<div className="flex flex-col gap-2 sm:gap-0">
			<SectionTitle>{t("referrals.your_referrals")}</SectionTitle>
			<Table>
				<div className="items-center justify-between rounded-t-xl bg-table-header-primary py-3 px-5 pr-3 sm:py-5 sm:px-8 md:flex">
					<div className="max-md:hidden flex-grow grid" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
						{headers.map((header, i) => (
							<div
								className={`text-text-header ${i >= 1 ? "text-right" : "text-left"}`}
								key={`table-header-${i}`}
								onClick={(e) => handleTabOnChange(header)}
							>
								<span
									className={`text-base font-extrabold transition-colors duration-200 cursor-pointer ${
										tab === header ? "text-table-header-active font-bold" : "text-table-header-default hover:text-table-header-hover"
									}`}
								>
									{header}
								</span>
								{tab === header ? (
									<FontAwesomeIcon
										icon={reverse ? faArrowUpShortWide : faArrowDownWideShort}
										className="ml-2 cursor-pointer text-table-header-active"
										color="#092f62"
									/>
								) : null}
							</div>
						))}
					</div>
					<div className="md:hidden">
						<SortBySelect
							headers={headers}
							tab={tab}
							reverse={reverse}
							tabOnChange={handleTabOnChange}
						/>
					</div>
				</div>
				<TableBody>
					<>
						{sortedData.length === 0 ? (
							<TableRowEmpty>{t("referrals.no_referrals_yet")}</TableRowEmpty>
						) : (
							sortedData.slice(0, isShowMore ? sortedData.length : 3).map((row, i) => (
								<div key={i} className="bg-table-row-primary cursor-default px-5 py-5 sm:px-8 sm:py-4 border-t border-table-row-hover sm:first:rounded-t-none last:rounded-b-xl duration-300">
									<div className="flex flex-col justify-between gap-y-5 md:flex-row">
										<div className="max-md:hidden grid font-medium flex-grow items-center" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
											<div className="text-base sm:font-medium leading-tight text-left">{formatCurrency(formatUnits(BigInt(row.volume), 18), 0, 5)}</div>
											<div className="text-base sm:font-medium leading-tight text-right">{formatCurrency(formatUnits(BigInt(row.interest), 18), 0, 5)}</div>
											<div className="text-base sm:font-medium leading-tight text-right">{formatCurrency(formatUnits(BigInt(row.interestPaid), 18), 0, 5)}</div>
											<div className="text-base sm:font-medium leading-tight text-right">{formatCurrency(formatUnits(BigInt(row.bonus), 18), 0, 5)}</div>
											<div className="text-right">
												<Link
													href={ContractUrl(row.address as `0x${string}`)}
													className="text-base sm:font-medium leading-tight"
												>
													<span>{shortenAddress(row.address as `0x${string}`)}</span>
													<FontAwesomeIcon icon={faArrowUpRightFromSquare} className="w-3 ml-2" />
												</Link>
											</div>
										</div>
										{/* Mobile view */}
										<div className="md:hidden grid-cols-1 flex-1">
											<div className="grid grid-cols-2 gap-2 mb-2">
												<span className="font-medium">{headers[0]}:</span>
												<span>{formatCurrency(formatUnits(BigInt(row.volume), 18), 0, 5)}</span>
											</div>
											<div className="grid grid-cols-2 gap-2 mb-2">
												<span className="font-medium">{headers[1]}:</span>
												<span>{formatCurrency(formatUnits(BigInt(row.interest), 18), 0, 5)}</span>
											</div>
											<div className="grid grid-cols-2 gap-2 mb-2">
												<span className="font-medium">{headers[2]}:</span>
												<span>{formatCurrency(formatUnits(BigInt(row.interestPaid), 18), 0, 5)}</span>
											</div>
											<div className="grid grid-cols-2 gap-2 mb-2">
												<span className="font-medium">{headers[3]}:</span>
												<span>{formatCurrency(formatUnits(BigInt(row.bonus), 18), 0, 5)}</span>
											</div>
											<div className="grid grid-cols-2 gap-2">
												<span className="font-medium">{headers[4]}:</span>
												<Link
													href={ContractUrl(row.address as `0x${string}`)}
													className="text-base sm:font-medium leading-tight"
												>
													<span>{shortenAddress(row.address as `0x${string}`)}</span>
													<FontAwesomeIcon icon={faArrowUpRightFromSquare} className="w-3 ml-2" />
												</Link>
											</div>
										</div>
									</div>
								</div>
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


function sortReferralVolume(params: { referralVolume: ReferralData[], headers: string[], tab: string, reverse: boolean }): ReferralData[] {
	const { referralVolume, headers, tab, reverse } = params;

	if (tab === headers[0]) { // current savings balance
		referralVolume.sort((a, b) => Number(b.volume) - Number(a.volume));
	} else if (tab === headers[1]) { // total interest generated
		referralVolume.sort((a, b) => Number(b.interest) - Number(a.interest));
	} else if (tab === headers[2]) { // total interest paid
		referralVolume.sort((a, b) => Number(b.interestPaid) - Number(a.interestPaid));
	} else if (tab === headers[3]) { // bonus
		referralVolume.sort((a, b) => Number(b.bonus) - Number(a.bonus));
	} else if (tab === headers[4]) { // address
		referralVolume.sort((a, b) => a.address.localeCompare(b.address));
	}

	return reverse ? referralVolume.reverse() : referralVolume;
}