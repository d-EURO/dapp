import Head from "next/head";
import RatesSummary from "@components/PageRates/RatesSummary";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";

export default function RatesPage() {
	const { t } = useTranslation();

	return (
		<>
			<Head>
				<title>dEURO - {t("rates.title")}</title>
			</Head>

			<div className="flex flex-col gap-[4rem] mt-[4rem]">
				<RatesSummary />
			</div>
		</>
	);
}

export async function getStaticProps({ locale }: { locale: string }) {
	return {
		props: {
			...(await serverSideTranslations(locale, ["common"])),
		},
	};
}
