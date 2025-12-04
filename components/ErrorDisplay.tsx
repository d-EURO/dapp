interface ErrorDisplayProps {
	error?: string | null;
}

export const ErrorDisplay = ({ error }: ErrorDisplayProps) => {
	if (!error) return null;
	return <div className="ml-1 text-text-warning text-sm">{error}</div>;
};
