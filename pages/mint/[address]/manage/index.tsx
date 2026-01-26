import Head from "next/head";
import { useTranslation } from "next-i18next";
import { useRouter } from "next/router";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { SectionTitle } from "@components/SectionTitle";
import { AdjustPosition, Target } from "@components/PageMint/AdjustPosition";
import AppCard from "@components/AppCard";
import { TOKEN_SYMBOL } from "@utils";
import { usePositionManageData } from "../../../../hooks/usePositionManageData";

enum Route {
	LOAN = "loan",
	COLLATERAL = "collateral",
	LIQUIDATION_PRICE = "liquidation-price",
	EXPIRATION = "expiration",
}

export default function PositionManage() {
	const { t } = useTranslation();
	const router = useRouter();
	const { address: addressQuery } = router.query;

	const { position, collateralBalance, currentDebt, liqPrice, isInCooldown, cooldownRemainingFormatted, cooldownEndsAt, isLoading } =
		usePositionManageData(addressQuery);

	const handleSelectTarget = (target: Target) => {
		const targetToRoute: Record<Target, Route> = {
			[Target.LOAN]: Route.LOAN,
			[Target.COLLATERAL]: Route.COLLATERAL,
			[Target.LIQ_PRICE]: Route.LIQUIDATION_PRICE,
			[Target.EXPIRATION]: Route.EXPIRATION,
		};
		const route = targetToRoute[target];
		if (route) {
			router.push(`/mint/${addressQuery}/manage/${route}`);
		}
	};

	if (isLoading || !position) {
		return (
			<div className="md:mt-8 flex justify-center">
				<AppCard className="max-w-lg w-full p-6 flex flex-col gap-y-6">
					<div className="flex justify-center items-center h-64">
						<span className="text-text-muted2">Loading...</span>
					</div>
				</AppCard>
			</div>
		);
	}

	return (
		<>
			<Head>
				<title>
					{TOKEN_SYMBOL} - {t("my_positions.manage_position")}
				</title>
			</Head>
			<div className="md:mt-8 flex justify-center">
				<AppCard className="max-w-lg w-full p-6 flex flex-col gap-y-6">
					<SectionTitle className="!mb-0 text-center !text-xl">{t("mint.adjust_your_borrowing_position")}</SectionTitle>

					<AdjustPosition
						position={position}
						collateralBalance={collateralBalance}
						currentDebt={currentDebt}
						liqPrice={liqPrice}
						onSelectTarget={handleSelectTarget}
						isInCooldown={isInCooldown}
						cooldownRemainingFormatted={cooldownRemainingFormatted}
						cooldownEndsAt={cooldownEndsAt}
					/>
				</AppCard>
			</div>
		</>
	);
}

export async function getServerSideProps({ locale }: { locale: string }) {
	return {
		props: {
			...(await serverSideTranslations(locale, ["common"])),
		},
	};
}
