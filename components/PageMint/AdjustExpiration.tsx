import { useTranslation } from "next-i18next";
import { ExpirationManageSection } from "./ExpirationManageSection";

interface AdjustExpirationProps {
	onBack: () => void;
}

export const AdjustExpiration = ({ onBack }: AdjustExpirationProps) => {
	const { t } = useTranslation();

	return (
		<div className="flex flex-col gap-y-4">
			<button onClick={onBack} className="text-left text-primary hover:text-primary-hover text-sm font-medium">
				← {t("common.back")}
			</button>
			<ExpirationManageSection />
		</div>
	);
};
