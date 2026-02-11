import axios from "axios";
import { CONFIG } from "@config";

// Dynamic API client that switches based on chainId
export function getApiClient(chainId: number) {
	const API_ENDPOINTS: Record<number, string> = {
		4114: CONFIG.api.mainnet,
		5115: CONFIG.api.testnet,
	};

	const baseURL = API_ENDPOINTS[chainId];

	if (!baseURL) {
		throw new Error(`Unsupported chainId: ${chainId}. Expected 4114 (mainnet) or 5115 (testnet)`);
	}

	return axios.create({ baseURL });
}
