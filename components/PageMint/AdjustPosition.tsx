import { useTranslation } from "next-i18next";
import { formatUnits, zeroAddress, Address } from "viem";
import { formatCurrency, normalizeTokenSymbol, shortenAddress, formatDate } from "@utils";
import Link from "next/link";
import AppBox from "@components/AppBox";
import dynamic from "next/dynamic";
const TokenLogo = dynamic(() => import("@components/TokenLogo"), { ssr: false });
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
import { useContractUrl } from "../../hooks/useContractUrl";
import { PositionQuery } from "@juicedollar/api";

export enum Target {
	COLLATERAL = "COLLATERAL",
	LIQ_PRICE = "LIQ_PRICE",
	LOAN = "LOAN",
	EXPIRATION = "EXPIRATION",
}

interface AdjustPositionProps {
	position: PositionQuery;
	collateralBalance: bigint;
	currentDebt: bigint;
	liqPrice: bigint;
	onSelectTarget: (target: Target) => void;
}

export const AdjustPosition = ({ position, collateralBalance, currentDebt, liqPrice, onSelectTarget }: AdjustPositionProps) => {
	const { t } = useTranslation();
	const url = useContractUrl((position.position as Address) || zeroAddress);
	const priceDecimals = 36 - (position.collateralDecimals || 18);

	const targets = [
		{
			id: Target.LOAN,
			label: t("mint.loan_amount"),
			desc: t("mint.adjust_loan_amount_description"),
			value: currentDebt,
			decimals: 18,
			currency: position.stablecoinSymbol,
		},
		{
			id: Target.COLLATERAL,
			label: t("mint.collateral"),
			desc: t("mint.adjust_collateral_description"),
			value: collateralBalance,
			decimals: position.collateralDecimals,
			currency: normalizeTokenSymbol(position.collateralSymbol),
		},
		{
			id: Target.LIQ_PRICE,
			label: t("mint.liquidation_price"),
			desc: t("mint.adjust_liq_price_description"),
			value: liqPrice,
			decimals: priceDecimals,
			currency: position.stablecoinSymbol,
		},
		{
			id: Target.EXPIRATION,
			label: t("mint.expiration"),
			desc: t("mint.adjust_expiration_description"),
			value: null,
			decimals: 0,
			currency: "",
		},
	];

	return (
		<div className="flex flex-col gap-y-4">
			<Link href={url} target="_blank">
				<div className="text-lg font-bold underline text-center">
					{t("monitoring.position")} {shortenAddress(position.position)}
					<FontAwesomeIcon icon={faArrowUpRightFromSquare} className="w-3 ml-2" />
				</div>
			</Link>

			<div className="flex flex-col gap-2">
				{targets.map((target) => (
					<button
						key={target.id}
						onClick={() => onSelectTarget(target.id)}
						className="text-left hover:opacity-80 transition-opacity"
					>
						<AppBox className="h-full transition-all hover:ring-2 hover:ring-orange-300">
							<div className="flex items-center gap-4">
								<div className="flex-shrink-0">
									<TokenLogo currency={target.currency || position.stablecoinSymbol} size={10} />
								</div>
								<div className="flex-1">
									<div className="text-lg font-bold text-text-title">
										{t("mint.adjust")} {target.label}
									</div>
									<p className="text-sm text-text-muted2">{target.desc}</p>
									<div className="mt-2 text-base font-bold">
										{target.value !== null ? (
											<>
												{formatCurrency(formatUnits(target.value, target.decimals))} {target.currency}
											</>
										) : (
											formatDate(position.expiration)
										)}
									</div>
								</div>
							</div>
						</AppBox>
					</button>
				))}
			</div>
		</div>
	);
};
