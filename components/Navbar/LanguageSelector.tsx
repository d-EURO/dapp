import { useTranslation } from "next-i18next";
import Select, { components } from "react-select";
import { useLanguageSelector } from "../../hooks/useLanguageSelector";
import { useTheme } from "../../contexts/ThemeContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSun, faMoon } from "@fortawesome/free-solid-svg-icons";

type OptionType = { value: string; label: string };

export const LanguageSelector = () => {
	const { options, selectedLanguage, handleLanguageChange } = useLanguageSelector();
	const { t } = useTranslation();
	const { theme, toggleTheme } = useTheme();

	return (
		<div className="flex flex-col gap-5 min-w-[300px] sm:min-w-[300px] md:min-w-[300px]">
			<div className="inline-flex items-center justify-between cursor-pointer w-full">
				<span className="text-base font-extrabold flex items-center">{t("common.navbar.language")}</span>
				<button
					onClick={toggleTheme}
					className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
					aria-label="Toggle dark mode"
				>
					<FontAwesomeIcon 
						icon={theme === 'dark' ? faSun : faMoon} 
						className="w-5 h-5 text-gray-600 dark:text-gray-300"
					/>
				</button>
			</div>
			<div className="flex flex-row justify-start gap-2">
				{options.map((option) => (
					<button
						className={`text-[#4f566d] text-sm font-medium rounded-lg p-2 px-3  ${
							selectedLanguage === option.value ? "bg-menu-active-bg !font-extrabold !text-text-primary" : ""
						} ${option.disabled ? "!hover:bg-white !text-[#BDC1CE]" : "hover:text-text-primary hover:bg-menu-hover-bg"}`}
						key={option.value}
						onClick={() => handleLanguageChange(option.value)}
						disabled={option.disabled}
					>
						{option.value.toUpperCase()}
					</button>
				))}
			</div>
		</div>
	);
};

export const LanguageSelectorDropdown = () => {
	const { options, selectedLanguage, handleLanguageChange } = useLanguageSelector();
	const { t } = useTranslation();
	const { theme, toggleTheme } = useTheme();

	const filteredOptions = options.filter((option) => !option.disabled).map((option) => ({ value: option.value, label: option.value.toUpperCase() }));
	
	return (
		<div className="flex items-center gap-2">
			<button
				onClick={toggleTheme}
				className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
				aria-label="Toggle dark mode"
			>
				<FontAwesomeIcon 
					icon={theme === 'dark' ? faSun : faMoon} 
					className="w-4 h-4 text-gray-600 dark:text-gray-300"
				/>
			</button>
			<Select<OptionType>
				className="flex-1 text-base font-medium leading-tight"
				options={filteredOptions}
				defaultValue={selectedLanguage ? { value: selectedLanguage, label: selectedLanguage.toUpperCase() } : undefined}
				value={selectedLanguage ? { value: selectedLanguage, label: selectedLanguage.toUpperCase() } : undefined}
				onChange={(o) => o && handleLanguageChange(o.value)}
				styles={{
					indicatorSeparator: () => ({
						display: "none",
					}),
					dropdownIndicator: (baseStyles) => ({
						...baseStyles,
						color: theme === 'dark' ? "#94a3b8" : "#272b37",
					}),
					control: (baseStyles, state) => ({
						...baseStyles,
						backgroundColor: theme === 'dark' ? "#1e293b" : "#ffffff",
						color: theme === 'dark' ? "#e2e8f0" : "#272b37",
						borderColor: theme === 'dark' ? "#475569" : "#e9ebf0",
						borderRadius: "0.5rem",
						borderWidth: "0.5px",
						boxShadow: "none",
						minWidth: "6.5rem",
						height: "1.5rem",
						"&:hover": {
							borderColor: theme === 'dark' ? "#64748b" : "#cbd5e1",
						},
					}),
					option: (baseStyles, state) => ({
						...baseStyles,
						backgroundColor: state.isSelected 
							? (theme === 'dark' ? "#334155" : "#e9ebf0")
							: "transparent",
						color: theme === 'dark' ? "#e2e8f0" : "#272b37",
						borderRadius: "0.5rem",
						fontWeight: "400",
						fontSize: "16px",
						marginTop: "2px",
						padding: "0.5625rem 0.5rem",
						"&:hover": {
							backgroundColor: theme === 'dark' ? "#475569" : "#f5f6f9",
						},
						"&:active": {
							backgroundColor: theme === 'dark' ? "#334155" : "#e9ebf0",
						},
					}),
					singleValue: (baseStyles) => ({
						...baseStyles,
						color: theme === 'dark' ? "#e2e8f0" : "#272b37",
						paddingLeft: "6px"
					}),
					menu: (baseStyles) => ({
						...baseStyles,
						backgroundColor: theme === 'dark' ? "#1e293b" : "#ffffff",
						borderRadius: "0.5rem",
						overflow: "hidden",
						boxShadow: theme === 'dark' 
							? "0px 10px 22px 0px rgba(0,0,0,0.5)"
							: "0px 10px 22px 0px rgba(45,77,108,0.15)",
						marginTop: "0",
						border: theme === 'dark' ? "1px solid #475569" : "none",
					}),
					input: (baseStyles) => ({
						...baseStyles,
						color: theme === 'dark' ? "#e2e8f0" : "#272b37",
						fontSize: "0",
					}),
					menuList: (base, props) => ({
						...base,
						padding: "0",
					}),
				}}
				components={{
					Menu: ({ children, ...props }) => (
						<components.Menu {...props}>
							<div className="p-1">
								{children}
							</div>
						</components.Menu>
					),
				}}
			/>
		</div>
	);
};

export default LanguageSelector;