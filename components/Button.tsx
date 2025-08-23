import { useRouter } from "next/router";
import { getCarryOnQueryParams, toQueryString } from "../utils/url";
import LoadingSpin from "./LoadingSpin";
import Link from "next/link";
interface Props {
	size?: "sm" | "md";
	className?: string;
	isLoading?: boolean;
	disabled?: boolean;
	onClick?: (e: any) => void;
	children?: React.ReactNode;
	error?: string;
	width?: string;
}

export default function Button({ size = "md", width, className, onClick, isLoading, children, disabled, error }: Props) {
	const sizeClass = size == "sm" ? "text-sm px-2 py-1 md:px-3 md:py-1" : "px-3 py-3";

	return (
		<>
			{error && <div className="mb-2 px-1 text-text-warning text-center">{error}</div>}
			<button
				className={`
					btn
					${className} ${sizeClass}
				 	${
						disabled || isLoading
							? "font-medium cursor-not-allowed bg-[#e9ebf0] text-[#adb2c1] dark:bg-slate-800 dark:text-slate-500"
							: "font-extrabold bg-[#092f62] text-white hover:bg-[#0F80F0] hover:text-white dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500"
					} 
					${width ?? "w-full"}`}
				onClick={(e) => !disabled && !isLoading && onClick?.(e)}
			>
				{isLoading && <LoadingSpin />}
				{children}
			</button>
		</>
	);
}

export const SecondaryButton = ({ children, className, onClick, disabled, isLoading }: Props) => {
	const baseClass = "btn text-base font-extrabold";
	const enabledClass = !disabled && !isLoading 
		? "bg-[#F5F6F9] text-[#272B38] hover:bg-[#EAEBF0] hover:text-[#272B38] dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 dark:hover:text-slate-100" 
		: "cursor-not-allowed bg-[#F5F6F9] text-[#ADB2C2] dark:bg-slate-800/50 dark:text-slate-500";

	return (
		<button
			className={`${baseClass} ${enabledClass} ${className || ''}`}
			onClick={(e) => !disabled && !isLoading && onClick?.(e)}
			disabled={disabled || isLoading}
		>
			{isLoading && <LoadingSpin />}
			{children}
		</button>
	);
};

interface SecondaryLinkButtonProps extends Props {
	href: string;
}

export const SecondaryLinkButton = ({ children, className, onClick, disabled, isLoading, href }: SecondaryLinkButtonProps) => {
	const router = useRouter();
	const carryOnQueryParams = getCarryOnQueryParams(router);

	const _href = `${href}${toQueryString(carryOnQueryParams)}`;

	return (
		<Link
			href={_href}
			className={`btn text-base font-extrabold bg-[#F5F6F9] text-[#272B38] hover:bg-[#EAEBF0] hover:text-[#272B38] dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 dark:hover:text-slate-100 ${className || ''}`}
			onClick={(e) => !disabled && !isLoading && onClick?.(e)}
		>
			{isLoading && <LoadingSpin />}
			{children}
		</Link>
	);
};

interface SegmentedControlButtonProps {
	selected?: boolean;
	children?: React.ReactNode;
	onClick?: () => void;
}

export const SegmentedControlButton = ({ children, selected, onClick }: SegmentedControlButtonProps) => {
	return (
		<button
			className={`btn px-3 py-1.5 rounded-lg ${selected ? "bg-white dark:bg-slate-700" : "bg-transparent hover:bg-[#F9FAFC] dark:hover:bg-slate-800"} text-sm font-medium transition-all duration-300`}
			onClick={onClick}
		>
			{children}
		</button>
	);
};
