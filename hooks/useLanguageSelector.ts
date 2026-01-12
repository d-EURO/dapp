import { useTranslation } from "next-i18next";
import { useRouter } from "next/router";
import { useEffect } from "react";

type LanguageOption = { value: string; disabled?: boolean };

export const useLanguageSelector = () => {
	const { i18n } = useTranslation();
	const router = useRouter();
	const options: LanguageOption[] = [{ value: "en" }, { value: "de" }, { value: "es" }, { value: "fr" }, { value: "it" }];

	const handleLanguageChange = (locale: string) => {
		const { pathname, asPath, query } = router;
		router.push({ pathname, query }, asPath, { locale, scroll: false });
		localStorage.setItem("APP_LOCALE", locale);
		// Only call changeLanguage if i18n is properly initialized
		if (i18n && typeof i18n.changeLanguage === "function") {
			i18n.changeLanguage(locale);
		}
	};

	useEffect(() => {
		if (router.isReady && i18n && typeof i18n.changeLanguage === "function") {
			const locale = localStorage.getItem("APP_LOCALE");
			const isValidLocale = locale && options.find((opt) => opt.value === locale && !opt.disabled);
			if (isValidLocale && locale !== i18n.language) {
				handleLanguageChange(locale);
			} else if (locale && !isValidLocale) {
				localStorage.removeItem("APP_LOCALE");
			}
		}
	}, [router.isReady, i18n]);

	return { options, selectedLanguage: i18n?.language || "en", handleLanguageChange };
};
