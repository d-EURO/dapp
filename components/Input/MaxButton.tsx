export const MaxButton = ({ onClick, className, label = "MAX", disabled = false }: { onClick: () => void; className?: string; label?: string; disabled?: boolean }) => {
	return (
		<button
			className={`${className} h-full px-2 py-2.5 bg-button-max-bg hover:bg-button-max-hover hover:cursor-pointer rounded-md justify-center items-center gap-2 flex overflow-hidden`}
			onClick={onClick}
			disabled={disabled}
		>
			<span className="text-button-max-text text-xs font-extrabold leading-tight whitespace-nowrap">{label}</span>
		</button>
	);
};