import { useQuery } from "@tanstack/react-query";
import { CONFIG } from "../app.config";

export const useDefaultReferencePosition = (collateralAddress?: string) => {
	return useQuery({
		queryKey: ["defaultPosition", collateralAddress],
		queryFn: async () => {
			const response = await fetch(`${CONFIG.api}/positions/default?collateral=${collateralAddress}`);
			if (!response.ok) throw new Error("Failed to fetch default position");
			return response.json();
		},
		enabled: !!collateralAddress,
		staleTime: 5 * 60 * 1000,
	});
};
