import {
	ApiLeadrateProposed as BaseApiLeadrateProposed,
	ApiLeadrateRate,
	ApiSavingsInfo as BaseApiSavingsInfo,
	ApiSavingsUserLeaderboard,
	ApiSavingsUserTable as BaseApiSavingsUserTable,
	LeadrateProposed,
} from "@deuro/api";
import { Address } from "viem";

export type { ApiLeadrateRate, ApiSavingsUserLeaderboard };

export type SavingsVaultHistoryEntry = {
	id: string;
	vault: Address;
	owner: Address;
	assets: string;
	blockheight: number;
	timestamp: number;
	txHash: string;
};

export type ApiSavingsUserTable = BaseApiSavingsUserTable & {
	vaultSave?: SavingsVaultHistoryEntry[];
	vaultWithdraw?: SavingsVaultHistoryEntry[];
};

export type ApiLeadrateVersionInfo = {
	rate: number;
	nextRate?: number;
	nextchange?: number;
	isProposal: boolean;
	isPending: boolean;
};

export type ApiLeadrateInfo = {
	v2: ApiLeadrateVersionInfo;
	v3: ApiLeadrateVersionInfo;
};

export type LeadrateProposedWithSource = LeadrateProposed & {
	source?: string;
};

export type ApiLeadrateProposed = Omit<BaseApiLeadrateProposed, "list"> & {
	list: LeadrateProposedWithSource[];
};

export type ApiSavingsInfo = BaseApiSavingsInfo & {
	rateV2?: number;
	rateV3?: number;
};

// --------------------------------------------------------------------------------
export type SavingsState = {
	error: string | null;
	loaded: boolean;

	leadrateInfo: ApiLeadrateInfo | undefined;
	leadrateProposed: ApiLeadrateProposed | undefined;
	leadrateRate: ApiLeadrateRate | undefined;

	savingsInfo: ApiSavingsInfo | undefined;

	savingsUserTable: ApiSavingsUserTable | undefined;
	savingsAllUserTable: ApiSavingsUserTable | undefined;
	savingsLeaderboard: ApiSavingsUserLeaderboard[] | undefined;
};

// --------------------------------------------------------------------------------
export type DispatchBoolean = {
	type: string;
	payload: Boolean;
};

export type DispatchApiLeadrateInfo = {
	type: string;
	payload: ApiLeadrateInfo | undefined;
};

export type DispatchApiLeadrateProposed = {
	type: string;
	payload: ApiLeadrateProposed | undefined;
};

export type DispatchApiLeadrateRate = {
	type: string;
	payload: ApiLeadrateRate | undefined;
};

export type DispatchApiSavingsInfo = {
	type: string;
	payload: ApiSavingsInfo | undefined;
};

export type DispatchApiSavingsUserTable = {
	type: string;
	payload: ApiSavingsUserTable | undefined;
};

export type DispatchApiSavingsLeaderboard = {
	type: string;
	payload: ApiSavingsUserLeaderboard[] | undefined;
};
