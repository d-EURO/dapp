import {
	ApiEcosystemCollateralPositions,
	ApiEcosystemCollateralStats,
	ApiEcosystemDepsInfo,
	ApiEcosystemStablecoinInfo,
	ApiMinterListing,
} from "@deuro/api";

// --------------------------------------------------------------------------------
export type ExposureItem = {
	collateral: {
		address: string;
		chainId: number;
		name: string;
		symbol: string;
	};
	positions: {
		open: number;
		originals: number;
		clones: number;
	};
	mint: {
		totalMinted: number;
		totalContribution: number;
		totalLimit: number;
		totalMintedRatio: number;
		interestAverage: number;
		totalTheta: number;
		thetaPerDepsToken: number;
	};
	reserveRiskWiped: {
		depsPrice: number;
		riskRatio: number;
	};
};

export type AnalyticsExposure = {
	general: {
		balanceInReserve: number;
		mintersContribution: number;
		equityInReserve: number;
		depsPrice: number;
		depsTotalSupply: number;
		thetaFromPositions: number;
		thetaPerToken: number;
		earningsPerAnnum: number;
		earningsPerToken: number;
		priceToEarnings: number;
		priceToBookValue: number;
	};
	exposures: ExposureItem[];
};

// --------------------------------------------------------------------------------
export type EcosystemState = {
	error: string | null;
	loaded: boolean;

	collateralPositions: ApiEcosystemCollateralPositions | undefined;
	collateralStats: ApiEcosystemCollateralStats | undefined;
	depsInfo: ApiEcosystemDepsInfo | undefined;
	stablecoinInfo: ApiEcosystemStablecoinInfo | undefined;
	stablecoinMinters: ApiMinterListing | undefined;
	exposureData: AnalyticsExposure | undefined;
};

// --------------------------------------------------------------------------------
export type DispatchBoolean = {
	type: string;
	payload: Boolean;
};

export type DispatchApiEcosystemCollateralPositions = {
	type: string;
	payload: ApiEcosystemCollateralPositions | undefined;
};

export type DispatchApiEcosystemCollateralStats = {
	type: string;
	payload: ApiEcosystemCollateralStats | undefined;
};

export type DispatchApiEcosystemNativePoolShareInfo = {
	type: string;
	payload: ApiEcosystemDepsInfo | undefined;
};

export type DispatchApiEcosystemStablecoinInfo = {
	type: string;
	payload: ApiEcosystemStablecoinInfo | undefined;
};

export type DispatchApiEcosystemStablecoinMinters = {
	type: string;
	payload: ApiMinterListing | undefined;
};

export type DispatchAnalyticsExposure = {
	type: string;
	payload: AnalyticsExposure | undefined;
};
