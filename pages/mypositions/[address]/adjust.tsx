import { useEffect } from "react";
import { useRouter } from "next/router";
import { getCarryOnQueryParams, toQueryString } from "@utils";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";

export default function PositionAdjust() {
	const router = useRouter();
	const { address } = router.query;
	const carryOnQueryParams = getCarryOnQueryParams(router);

	useEffect(() => {
		if (!router.isReady || typeof address !== "string") return;
		router.replace(`/mint/${address}/manage${toQueryString(carryOnQueryParams)}`);
	}, [address, carryOnQueryParams, router]);

	return null;
}

export async function getServerSideProps({ locale }: { locale: string }) {
	return {
		props: {
			...(await serverSideTranslations(locale, ["common"])),
		},
	};
}
