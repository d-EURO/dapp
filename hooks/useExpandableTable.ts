import { useState, useMemo } from "react";

export const DEFAULT_VISIBLE_ROWS = 3;

interface UseExpandableTableResult<T> {
	visibleData: T[];
	isExpanded: boolean;
	toggleExpanded: () => void;
	showExpandButton: boolean;
	totalCount: number;
}

export function useExpandableTable<T>(data: T[], defaultVisibleRows: number = DEFAULT_VISIBLE_ROWS): UseExpandableTableResult<T> {
	const [isExpanded, setIsExpanded] = useState(false);

	const visibleData = useMemo(() => {
		return isExpanded ? data : data.slice(0, defaultVisibleRows);
	}, [data, isExpanded, defaultVisibleRows]);

	const toggleExpanded = () => setIsExpanded((prev) => !prev);

	const showExpandButton = data.length > defaultVisibleRows;

	return {
		visibleData,
		isExpanded,
		toggleExpanded,
		showExpandButton,
		totalCount: data.length,
	};
}
