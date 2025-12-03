import Head from "next/head";
import CollateralAndPositionsOverview from "@components/PageEcoSystem/CollateralAndPositionsOverview";
import DistributionDEURO from "@components/PageEcoSystem/DistributionDEURO";
import { TOKEN_SYMBOL } from "@utils";

export default function Overview() {
	return (
		<div>
			<Head>
				<title>{TOKEN_SYMBOL} - EcoSystem</title>
			</Head>

			<div className="flex flex-col gap-[4rem] mt-[4rem]">
				<DistributionDEURO />

				<CollateralAndPositionsOverview />
			</div>
		</div>
	);
}
