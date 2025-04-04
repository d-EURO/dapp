import { useState } from "react";
import { BigNumberInput } from "./BigNumberInput";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { MaxButton } from "./MaxButton";
import TokenLogo from "@components/TokenLogo";
import { formatUnits } from "viem";
import { useTranslation } from "next-i18next";

interface TokenDescriptor {
	symbol: string;
	name: string;
	address: `0x${string}`;
	decimals: number;
	balanceOf?: bigint;
}

interface TokenInputSelectOutlinedProps {
	selectedToken: TokenDescriptor | null | undefined;
	onSelectTokenClick: () => void;
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
	usdValue?: string | number | null | undefined;
	eurValue?: string | number | null | undefined;
	isError?: boolean;
	errorMessage?: string;
}

export function TokenInputSelectOutlined({
	value,
	onChange,
	disabled,
	selectedToken,
	onSelectTokenClick,
	usdValue,
	eurValue,
	isError,
	errorMessage,
}: TokenInputSelectOutlinedProps) {
	const [isFocused, setIsFocused] = useState(false);
	const { t } = useTranslation();

	const handleOnFocus = () => {
		setIsFocused(true);
	};

	const handleOnBlur = () => {
		setIsFocused(false);
	};

	return (
		<div className="w-full self-stretch relative">
			<div
				className={`self-stretch p-2 rounded-xl border-2 border-transparent relative flex-col justify-center items-start gap-2 flex before:absolute before:inset-0 before:rounded-xl before:border before:pointer-events-none before:transition-colors before:duration-200 ${
					isFocused ? "before:border-2 before:border-input-borderFocus" : "before:border-input-border hover:before:border-input-borderHover"
				}`}
			>
				<div className="self-stretch justify-start items-center gap-3 inline-flex">
					<div className="grow h-11 px-2 py-3 bg-white rounded-lg justify-start items-center flex min-w-0">
						<BigNumberInput
							className={`w-full pl-0 text-input-primary placeholder:text-input-placeholder text-2xl font-medium leading-tight ${
								isError ? "!text-text-warning" : ""
							}`}
							placeholder="0"
							value={value}
							onChange={onChange}
							decimals={selectedToken?.decimals || 18}
							disabled={disabled}
							onFocus={handleOnFocus}
							onBlur={handleOnBlur}
						/>
					</div>
					<button
						className="min-w-40 h-11 px-3 py-2.5 bg-input-bg rounded-lg justify-between items-center flex shrink-0 gap-1"
						onClick={onSelectTokenClick}
					>
						{selectedToken ? (
							<div className="flex items-center">
								<span className="flex items-center mr-1.5">
									<TokenLogo currency={selectedToken.symbol} size={5} />
								</span>
								<span className="text-lg font-medium leading-tight flex items-center">{selectedToken.symbol}</span>
							</div>
						) : (
							<div className="text-input-label text-lg font-medium leading-normal">{t("common.select_token")}</div>
						)}
						<FontAwesomeIcon icon={faChevronDown} className="w-4.5 h-4.5 relative overflow-hidden" />
					</button>
				</div>
				<div className="self-stretch justify-start items-center inline-flex">
					<div className="grow shrink basis-0 h-4 px-2 justify-start items-center gap-2 flex max-w-full overflow-hidden">
						<div className="text-input-label text-xs font-medium leading-none">€{eurValue}</div>
						<div className="h-4 w-0.5 border-l border-input-placeholder"></div>
						<div className="text-input-label text-xs font-medium leading-none">${usdValue}</div>
					</div>
					<div className="h-7 justify-end items-center gap-2.5 flex">
						{selectedToken && (
							<>
								<div className="text-input-label text-xs font-medium leading-none">
									{formatUnits(selectedToken.balanceOf || 0n, selectedToken.decimals || 18)} {selectedToken.symbol}
								</div>
								<MaxButton onClick={() => onChange(selectedToken?.balanceOf?.toString() || "0")} />
							</>
						)}
					</div>
				</div>
			</div>
			{isError && errorMessage && (
				<div className="absolute mt-1.5 text-text-warning text-xs font-medium leading-none">{errorMessage}</div>
			)}
		</div>
	);
}
