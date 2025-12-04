import Button from "./Button";
import { useTranslation } from "next-i18next";

interface ManageButtonsProps {
	onBack: () => void;
	onAction: () => void;
	actionLabel: string;
	disabled?: boolean;
	isLoading?: boolean;
	backButtonDisabled?: boolean;
}

export const ManageButtons = ({
	onBack,
	onAction,
	actionLabel,
	disabled = false,
	isLoading = false,
	backButtonDisabled = false,
}: ManageButtonsProps) => {
	const { t } = useTranslation();

	return (
		<div className="grid grid-cols-2 gap-4">
			<Button
				className="text-lg leading-snug !font-extrabold !bg-button-primary-disabled-bg !text-button-secondary-default-text"
				onClick={onBack}
				disabled={backButtonDisabled}
			>
				{t("common.back")}
			</Button>
			<Button className="text-lg leading-snug !font-extrabold" onClick={onAction} disabled={disabled} isLoading={isLoading}>
				{actionLabel}
			</Button>
		</div>
	);
};
