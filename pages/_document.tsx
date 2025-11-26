import { Html, Head, Main, NextScript } from "next/document";
import { Analytics } from "@vercel/analytics/react";

export default function Document() {
	return (
		<Html lang="en">
			<Head>
				<meta property="og:type" content="website" />
				<meta property="og:url" content="https://app.deuro.com/" />
				<meta content="dEURO - Decentralized Euro." property="og:title" />
				<meta content="dEURO is a collateralized, oracle-free stablecoin that tracks the value of the Euro. Its strengths are its decentralization and its versatility." property="og:description" />
				<meta content="https://juicedollar.com/Brand_Kit/02_Web_App/Og_image/JUSD-open-graph-preview.png" property="og:image" />
				<meta content="dEURO is a collateralized, oracle-free stablecoin that tracks the value of the Euro. Its strengths are its decentralization and its versatility." name="description" />
				<meta content="dEURO - Decentralized Euro." property="twitter:title" />
				<meta content="dEURO is a collateralized, oracle-free stablecoin that tracks the value of the Euro. Its strengths are its decentralization and its versatility." property="twitter:description" />
				<meta content="https://juicedollar.com/Brand_Kit/02_Web_App/Og_image/JUSD-open-graph-preview.png" property="twitter:image" />
				<meta content="summary_large_image" name="twitter:card" />
			</Head>
			<body className="font-sans container-xl mx-auto bg-layout-primary text-text-primary">
				<Main />
				<NextScript />
				<Analytics />
			</body>
		</Html>
	);
}
