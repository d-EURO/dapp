import Head from "next/head";
import { useTranslation } from "next-i18next";
import { useRouter } from "next/router";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { SectionTitle } from "@components/SectionTitle";
import { AdjustExpiration } from "@components/PageMint/AdjustExpiration";
import AppCard from "@components/AppCard";
import { TOKEN_SYMBOL } from "@utils";
import { usePositionManageData } from "../../../../hooks/usePositionManageData";

export default function ManageExpiration() {
	const { t } = useTranslation();
	const router = useRouter();
	const { address: addressQuery } = router.query;

	const { position, isLoading } = usePositionManageData(addressQuery);

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
					{TOKEN_SYMBOL} - {t("mint.expiration")}
				</title>
			</Head>
			<div className="md:mt-8 flex justify-center">
				<AppCard className="max-w-lg w-full p-6 flex flex-col gap-y-6">
					<SectionTitle className="!mb-0 text-center !text-xl">{t("mint.adjust_your_borrowing_position")}</SectionTitle>
					<AdjustExpiration position={position} />
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
