import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendarDays } from "@fortawesome/free-solid-svg-icons";
import ReactDatePicker from "react-datepicker";
import { useState } from "react";

interface DateInputOutlinedProps {
	value: Date | undefined | null;
	onChange: (date: Date | null) => void;
	maxDate?: Date | undefined | null;
	rightAdornment?: React.ReactNode;
	placeholderText?: string;
	className?: string;
}

export function DateInputOutlined({ value, maxDate, onChange, rightAdornment, placeholderText, className }: DateInputOutlinedProps) {
	const [isFocused, setIsFocused] = useState(false);

	return (
		<div
			className={`w-full p-2 rounded-xl border-2 border-transparent relative flex-row justify-between items-center gap-2 flex before:absolute before:inset-0 before:rounded-xl before:border before:pointer-events-none before:transition-colors before:duration-200 ${
				isFocused ? "before:border-2 before:border-input-borderFocus" : "before:border-input-border hover:before:border-input-borderHover"
			}`}
		>
			<div className="flex min-w-0 flex-1">
				<ReactDatePicker
					showIcon
					toggleCalendarOnIconClick
					icon={<FontAwesomeIcon icon={faCalendarDays} className="!w-5 !h-5 !text-input-placeholder !mt-[0.1rem]" />}
					className={`${className} w-full !pl-8 text-[1.375rem] font-medium align-middle leading-none placeholder:text-input-placeholder !placeholder:text-[1.375rem]`}
					id="expiration-datepicker"
					placeholderText={placeholderText}
					dateFormat={"yyyy-MM-dd"}
					selected={value}
					onChange={onChange}
					maxDate={maxDate}
					onFocus={() => setIsFocused(true)}
					onBlur={() => setIsFocused(false)}
					autoComplete="off"
				/>
			</div>
			{rightAdornment && <div className="flex-shrink-0">{rightAdornment}</div>}
		</div>
	);
}
