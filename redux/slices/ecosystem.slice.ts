import { createSlice, Dispatch } from "@reduxjs/toolkit";
import { FRANKENCOIN_API_CLIENT } from "../../app.config";
import {
	DispatchApiEcosystemCollateralPositions,
	DispatchApiEcosystemCollateralStats,
	DispatchApiEcosystemFpsInfo,
	DispatchApiEcosystemFrankencoinInfo,
	DispatchApiEcosystemFrankencoinMinters,
	DispatchBoolean,
	EcosystemState,
} from "./ecosystem.types";
import {
	ApiEcosystemCollateralPositions,
	ApiEcosystemCollateralStats,
	ApiEcosystemFpsInfo,
	ApiEcosystemFrankencoinInfo,
	ApiMinterListing,
} from "@frankencoin/api";
import { zeroAddress } from "viem";

// --------------------------------------------------------------------------------

export const initialState: EcosystemState = {
	error: null,
	loaded: false,

	collateralPositions: {},
	collateralStats: { num: 0, addresses: [], totalValueLocked: { usd: 0, chf: 0 }, map: {} },
	fpsInfo: {
		raw: { price: "0", totalSupply: "0" },
		values: { fpsMarketCapInChf: 0, price: 0, totalSupply: 0 },
		earnings: { profit: 0, loss: 0 },
	},
	frankencoinInfo: {
		chain: { id: 0, name: "" },
		counter: { mint: 0, burn: 0 },
		erc20: { address: zeroAddress, decimals: 0, name: "", symbol: "" },
		price: { usd: 0 },
		raw: { mint: "0", burn: "0" },
		total: { mint: 0, burn: 0, supply: 0 },
	},
	frankencoinMinters: { num: 0, list: [] },
};

// --------------------------------------------------------------------------------

export const slice = createSlice({
	name: "ecosystem",
	initialState,
	reducers: {
		// HAS ERROR
		hasError(state, action: { payload: string }) {
			state.error = action.payload;
		},

		// SET LOADED
		setLoaded: (state, action: { payload: boolean }) => {
			state.loaded = action.payload;
		},

		// -------------------------------------
		// SET Collateral Positions
		setCollateralPositions: (state, action: { payload: ApiEcosystemCollateralPositions }) => {
			state.collateralPositions = action.payload;
		},

		// SET Collateral Stats
		setCollateralStats: (state, action: { payload: ApiEcosystemCollateralStats }) => {
			state.collateralStats = action.payload;
		},

		// SET Fps Info
		setFpsInfo: (state, action: { payload: ApiEcosystemFpsInfo }) => {
			state.fpsInfo = action.payload;
		},

		// SET Frankencoin Info
		setFrankencoinInfo: (state, action: { payload: ApiEcosystemFrankencoinInfo }) => {
			state.frankencoinInfo = action.payload;
		},

		// SET Frankencoin Minters
		setFrankencoinMinters: (state, action: { payload: ApiMinterListing }) => {
			state.frankencoinMinters = action.payload;
		},
	},
});

export const reducer = slice.reducer;
export const actions = slice.actions;

// --------------------------------------------------------------------------------
export const fetchEcosystem =
	() =>
	async (
		dispatch: Dispatch<
			| DispatchBoolean
			| DispatchApiEcosystemCollateralPositions
			| DispatchApiEcosystemCollateralStats
			| DispatchApiEcosystemFpsInfo
			| DispatchApiEcosystemFrankencoinInfo
			| DispatchApiEcosystemFrankencoinMinters
		>
	) => {
		// ---------------------------------------------------------------
		console.log("Loading [REDUX]: Ecosystem");

		// ---------------------------------------------------------------
		// Query raw data from backend api
		const response1 = await FRANKENCOIN_API_CLIENT.get("/ecosystem/collateral/positions");
		dispatch(slice.actions.setCollateralPositions(response1.data as ApiEcosystemCollateralPositions));

		const response2 = await FRANKENCOIN_API_CLIENT.get("/ecosystem/collateral/stats");
		dispatch(slice.actions.setCollateralStats(response2.data as ApiEcosystemCollateralStats));

		const response3 = await FRANKENCOIN_API_CLIENT.get("/ecosystem/fps/info");
		dispatch(slice.actions.setFpsInfo(response3.data as ApiEcosystemFpsInfo));

		const response4 = await FRANKENCOIN_API_CLIENT.get("/ecosystem/frankencoin/info");
		dispatch(slice.actions.setFrankencoinInfo(response4.data as ApiEcosystemFrankencoinInfo));

		const response5 = await FRANKENCOIN_API_CLIENT.get("/ecosystem/frankencoin/minter/list");
		dispatch(slice.actions.setFrankencoinMinters(response5.data as ApiMinterListing));

		// ---------------------------------------------------------------
		// Finalizing, loaded set to ture
		dispatch(slice.actions.setLoaded(true));
	};
