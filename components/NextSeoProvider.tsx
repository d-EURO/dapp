import { NextSeo } from "next-seo";
import { TOKEN_SYMBOL, SOCIAL } from "@utils";
import { CONFIG } from "@config";

export default function NextSeoProvider() {
	const twitterHandle = `@${SOCIAL.Twitter.split("/").pop()}`;

	return (
		<NextSeo
			title={TOKEN_SYMBOL}
			description={`The ${TOKEN_SYMBOL} is a collateralized, oracle-free stablecoin that tracks the value of the US dollar.`}
			openGraph={{
				type: "website",
				locale: "en_US",
				url: CONFIG.app,
			}}
			twitter={{
				handle: twitterHandle,
				site: twitterHandle,
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
