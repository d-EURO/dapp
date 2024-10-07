import { Address, formatUnits, zeroAddress } from "viem";
import TableRow from "../Table/TableRow";
import { PositionQuery, ChallengesQueryStatus, BidsQueryItem, BidsQueryType, ChallengesQueryItem } from "@frankencoin/api";
import { RootState } from "../../redux/redux.store";
import { useSelector } from "react-redux";
import TokenLogo from "@components/TokenLogo";
import { formatCurrency } from "../../utils/format";
import { useRouter as useNavigation } from "next/navigation";
import { useContractUrl } from "@hooks";
import Button from "@components/Button";

interface Props {
	position: PositionQuery;
}

export default function MonitoringRow({ position }: Props) {
	const navigate = useNavigation();

	const prices = useSelector((state: RootState) => state.prices.coingecko);
	const challenges = useSelector((state: RootState) => state.challenges.positions);
	const bids = useSelector((state: RootState) => state.bids.positions);
	const url = useContractUrl(position.collateral || zeroAddress);
	const collTokenPrice = prices[position.collateral.toLowerCase() as Address]?.price?.usd;
	const zchfPrice = prices[position.zchf.toLowerCase() as Address]?.price?.usd;
	if (!collTokenPrice || !zchfPrice) return null;

	const maturity: number = Math.round((position.expiration * 1000 - Date.now()) / 1000 / 60 / 60 / 24);

	const balance: number = Math.round((parseInt(position.collateralBalance) / 10 ** position.collateralDecimals) * 100) / 100;
	const balanceZCHF: number = Math.round(((balance * collTokenPrice) / zchfPrice) * 100) / 100;

	const liquidationZCHF: number = Math.round((parseInt(position.price) / 10 ** (36 - position.collateralDecimals)) * 100) / 100;
	const liquidationPct: number = Math.round((balanceZCHF / (liquidationZCHF * balance)) * 10000) / 100;

	const digits: number = position.collateralDecimals;
	const positionChallenges = challenges.map[position.position.toLowerCase() as Address] ?? [];
	const positionChallengesActive = positionChallenges.filter((ch: ChallengesQueryItem) => ch.status == "Active") ?? [];
	const positionChallengesActiveCollateral =
		positionChallengesActive.reduce<number>((acc, c) => {
			return acc + parseInt(formatUnits(c.size, digits - 2)) - parseInt(formatUnits(c.filledSize, digits - 2));
		}, 0) / 100;
	const collateralBalanceNumber: number = parseInt(formatUnits(BigInt(position.collateralBalance), digits - 2)) / 100;
	const challengesRatioPct: number = Math.round((positionChallengesActiveCollateral / collateralBalanceNumber) * 100);

	const openExplorer = (e: any) => {
		e.preventDefault();
		window.open(url, "_blank");
	};

	return (
		<TableRow
			actionCol={
				<Button className="h-10" onClick={() => navigate.push(`/monitoring/${position.position}/challenge`)}>
					Challenge
				</Button>
			}
		>
			{/* Collateral */}
			<div className="-ml-12 flex items-center">
				<div className="mr-4 cursor-pointer" onClick={openExplorer}>
					<TokenLogo currency={position.collateralSymbol} />
				</div>

				<div className={`col-span-2 text-text-primary text-left text-md`}>{`${formatCurrency(balance, 2, 2)} ${
					position.collateralSymbol
				}`}</div>
			</div>

			{/* Coll. */}
			<div className="flex flex-col gap-2">
				<div className={`col-span-2 text-md ${liquidationPct < 110 ? "text-text-warning font-bold" : "text-text-primary"}`}>
					{!isNaN(liquidationPct) ? formatCurrency(liquidationPct) : "-.--"}%
				</div>
			</div>

			{/* Expiration */}
			<div className="flex flex-col gap-2">
				<div className={`col-span-2 text-md ${maturity < 7 ? "text-text-warning font-bold" : "text-text-primary"}`}>
					{maturity < 3 ? (maturity > 0 ? `${Math.round(maturity * 24)} hours` : "Expired") : `${maturity} days`}
				</div>
			</div>

			{/* Challenges */}
			<div className="flex flex-col gap-2">
				<div className={`col-span-2 text-md text-text-primary`}>{challengesRatioPct == 0 ? "-" : `${challengesRatioPct}%`}</div>
			</div>
		</TableRow>
	);
}
