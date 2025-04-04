import Head from "next/head";
import Link from "next/link";
import BorrowTable from "@components/PageMint/BorrowTable";
import { useEffect } from "react";
import { RootState, store } from "../../redux/redux.store";
import { fetchPositionsList } from "../../redux/slices/positions.slice";
import { useSelector } from "react-redux";
import BorrowForm from "@components/PageMint/BorrowForm";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";

export default function Borrow() {
	const expertMode = useSelector((state: RootState) => state.globalPreferences.expertMode);
	const { t } = useTranslation();

	useEffect(() => {
		store.dispatch(fetchPositionsList());
	}, []);

	return (
		<>
			<Head>
				<title>dEURO - {t("mint.title")}</title>
			</Head>

			<BorrowForm />
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
