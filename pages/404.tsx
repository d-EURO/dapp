import Head from "next/head";
import Link from "next/link";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";
import { SOCIAL, TOKEN_SYMBOL } from "@utils";

export default function Custom404() {
	const { t } = useTranslation();
	return (
		<main className="container-xl mx-auto">
			<Head>
				<title>{TOKEN_SYMBOL} - 404</title>
			</Head>

			<div className="hidden w-10 h-10" />
			<div className="flex flex-col items-center justify-center w-full text-center" style={{ height: "60vh" }}>
				<h1 className="text-right text-4xl font-bold">
					<picture>
						<img src="/assets/JD-LOGO.svg" alt="logo" className="h-20" />
					</picture>
				</h1>
				<h1 className="text-4xl font-bold mt-10">{t("common.404.title")}</h1>
				<p className="text-2xl font-bold mt-4">
					<Link
						href={SOCIAL.Telegram}
						className="mr-4 hover:underline md:mr-6 text-rose-500"
						target="_blank"
						rel="noopener noreferrer"
					>
						{t("common.404.telegram_link")}
					</Link>
				</p>
			</div>
		</main>
	);
}

export async function getStaticProps({ locale }: { locale: string }) {
	return {
		props: {
			...(await serverSideTranslations(locale, ["common"])),
		},
	};
}
