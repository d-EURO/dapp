import { Html, Head, Main, NextScript } from "next/document";
import { Analytics } from "@vercel/analytics/react";

export default function Document() {
	return (
		<Html lang="en">
			<Head>
				<meta property="og:type" content="website" />
				<meta property="og:url" content="https://app.juicedollar.com/" />
				<meta content="JuiceDollar - The decentralized Bitcoin-backed USD on Citrea" property="og:title" />
				<meta content="JuiceDollar is a Bitcoin-collateralized, oracle-free stablecoin built on Citrea, the only true EVM layer on Bitcoin." property="og:description" />
				<meta content="https://juicedollar.com/Brand_Kit/02_Web_App/Og_image/JUSD-open-graph-preview.png" property="og:image" />
				<meta content="JuiceDollar is a Bitcoin-collateralized, oracle-free stablecoin built on Citrea, the only true EVM layer on Bitcoin." name="description" />
				<meta content="JuiceDollar - The decentralized Bitcoin-backed USD on Citrea" property="twitter:title" />
				<meta content="JuiceDollar is a Bitcoin-collateralized, oracle-free stablecoin built on Citrea, the only true EVM layer on Bitcoin." property="twitter:description" />
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
