import { NextSeo } from "next-seo";
import { TOKEN_SYMBOL } from "@utils";

export default function NextSeoProvider() {
	return (
		<NextSeo
			title={TOKEN_SYMBOL}
			description={`The ${TOKEN_SYMBOL} is a collateralized, oracle-free stablecoin that tracks the value of the Swiss franc.`}
			openGraph={{
				type: "website",
				locale: "en_US",
				url: "https://app.deuro.com/",
			}}
			twitter={{
				handle: "@dEURO_com",
				site: "@dEURO_com",
				cardType: "summary_large_image",
			}}
			themeColor="#f3f4f7"
			additionalLinkTags={[
				{
					rel: "icon",
					href: "/favicon.png",
					type: "image/png",
				},
			]}
		/>
	);
}
