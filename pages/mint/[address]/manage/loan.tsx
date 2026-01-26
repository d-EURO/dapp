import Head from "next/head";
import { useTranslation } from "next-i18next";
import { useRouter } from "next/router";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { SectionTitle } from "@components/SectionTitle";
import { AdjustLoan } from "@components/PageMint/AdjustLoan";
import AppCard from "@components/AppCard";
import { TOKEN_SYMBOL } from "@utils";
import { usePositionManageData } from "../../../../hooks/usePositionManageData";

export default function ManageLoan() {
	const { t } = useTranslation();
	const router = useRouter();
	const { address: addressQuery } = router.query;

	const {
		position,
		principal,
		collateralBalance,
		currentDebt,
		liqPrice,
		walletBalance,
		jusdAllowance,
		jusdBalance,
		isInCooldown,
		cooldownRemainingFormatted,
		cooldownEndsAt,
		currentPosition,
		refetch,
		isLoading,
	} = usePositionManageData(addressQuery);

	if (isLoading || !position || !currentPosition) {
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
					{TOKEN_SYMBOL} - {t("mint.loan_amount")}
				</title>
			</Head>
			<div className="md:mt-8 flex justify-center">
				<AppCard className="max-w-lg w-full p-6 flex flex-col gap-y-6">
					<SectionTitle className="!mb-0 text-center !text-xl">{t("mint.adjust_your_borrowing_position")}</SectionTitle>
					<AdjustLoan
						position={position}
						collateralBalance={collateralBalance}
						currentDebt={currentDebt}
						liqPrice={liqPrice}
						principal={principal}
						currentPosition={currentPosition}
						walletBalance={walletBalance}
						jusdAllowance={jusdAllowance}
						jusdBalance={jusdBalance}
						refetchAllowance={refetch}
						onSuccess={refetch}
						onFullRepaySuccess={() => router.push("/dashboard")}
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
