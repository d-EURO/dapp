import Head from "next/head";
import CoverageSummary from "@components/PageCoverage/CoverageSummary";
import CoveragePositions from "@components/PageCoverage/CoveragePositions";
import CoverageBridges from "@components/PageCoverage/CoverageBridges";
import CoverageReserves from "@components/PageCoverage/CoverageReserves";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";

export default function CoveragePage() {
	const { t } = useTranslation();

	return (
		<>
			<Head>
				<title>dEURO - {t("coverage.title")}</title>
			</Head>

			<div className="flex flex-col gap-[4rem] mt-[4rem]">
				<CoverageSummary />
				<CoveragePositions />
				<CoverageBridges />
				<CoverageReserves />
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
