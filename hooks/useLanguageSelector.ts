import { useTranslation } from "next-i18next";
import { useRouter } from "next/router";
import { useEffect } from "react";

export const useLanguageSelector = () => {
	const { i18n } = useTranslation();
	const router = useRouter();
	const options = [{ value: "en" }, { value: "de" }, { value: "es" }, { value: "fr" }, { value: "it", disabled: true }];

	const handleLanguageChange = (locale: string) => {
		const { pathname, asPath, query } = router;
		router.push({ pathname, query }, asPath, { locale, scroll: false });
        localStorage.setItem("APP_LOCALE", locale);
		i18n.changeLanguage(locale);
	};

    useEffect(() => {
        if(router.isReady) {
            const locale = localStorage.getItem("APP_LOCALE");
            if(locale && locale !== i18n.language) {
                handleLanguageChange(locale);
            }
        }
    }, [router.isReady]);

	return { options, selectedLanguage: i18n.language, handleLanguageChange };
};