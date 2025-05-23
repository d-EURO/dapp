import { ApiLeadrateInfo, ApiLeadrateProposed, ApiLeadrateRate, ApiSavingsInfo, ApiSavingsUserTable, ApiSavingsUserLeaderboard } from "@deuro/api";

// --------------------------------------------------------------------------------
export type SavingsState = {
	error: string | null;
	loaded: boolean;

	leadrateInfo: ApiLeadrateInfo;
	leadrateProposed: ApiLeadrateProposed;
	leadrateRate: ApiLeadrateRate;

	savingsInfo: ApiSavingsInfo;

	savingsUserTable: ApiSavingsUserTable;
	savingsAllUserTable: ApiSavingsUserTable;
	savingsLeaderboard: ApiSavingsUserLeaderboard[];
};

// --------------------------------------------------------------------------------
export type DispatchBoolean = {
	type: string;
	payload: Boolean;
};

export type DispatchApiLeadrateInfo = {
	type: string;
	payload: ApiLeadrateInfo;
};

export type DispatchApiLeadrateProposed = {
	type: string;
	payload: ApiLeadrateProposed;
};

export type DispatchApiLeadrateRate = {
	type: string;
	payload: ApiLeadrateRate;
};

export type DispatchApiSavingsInfo = {
	type: string;
	payload: ApiSavingsInfo;
};

export type DispatchApiSavingsUserTable = {
	type: string;
	payload: ApiSavingsUserTable;
};

export type DispatchApiSavingsLeaderboard = {
	type: string;
	payload: ApiSavingsUserLeaderboard[];
};
