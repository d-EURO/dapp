import { createSlice, Dispatch } from "@reduxjs/toolkit";
import {
	ApiChallengesChallengers,
	ApiChallengesListing,
	ApiChallengesMapping,
	ApiChallengesPositions,
	ApiChallengesPrices,
} from "@juicedollar/api";
import { getApiClient } from "@utils";
import {
	ChallengesState,
	DispatchApiChallengesChallengers,
	DispatchApiChallengesListing,
	DispatchApiChallengesMapping,
	DispatchApiChallengesPositions,
	DispatchApiChallengesPrices,
	DispatchBoolean,
} from "./challenges.types";
import { logApiError } from "../../utils/errorLogger";

// --------------------------------------------------------------------------------

export const initialState: ChallengesState = {
	error: null,
	loaded: false,

	list: undefined,
	mapping: undefined,
	challengers: undefined,
	positions: undefined,
	challengesPrices: undefined,
};

// --------------------------------------------------------------------------------

export const slice = createSlice({
	name: "challenges",
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
		// SET LIST
		setList: (state, action: { payload: ApiChallengesListing | undefined }) => {
			state.list = action.payload;
		},

		// -------------------------------------
		// SET MAPPING
		setMapping: (state, action: { payload: ApiChallengesMapping | undefined }) => {
			state.mapping = action.payload;
		},

		// -------------------------------------
		// SET Challengers
		setChallengers: (state, action: { payload: ApiChallengesChallengers | undefined }) => {
			state.challengers = action.payload;
		},

		// SET Positions
		setPositions: (state, action: { payload: ApiChallengesPositions | undefined }) => {
			state.positions = action.payload;
		},

		// SET Prices
		setPrices: (state, action: { payload: ApiChallengesPrices | undefined }) => {
			state.challengesPrices = action.payload;
		},
	},
});

export const reducer = slice.reducer;
export const actions = slice.actions;

// --------------------------------------------------------------------------------
export const fetchChallengesList =
	(chainId: number) =>
	async (
		dispatch: Dispatch<
			| DispatchBoolean
			| DispatchApiChallengesListing
			| DispatchApiChallengesMapping
			| DispatchApiChallengesChallengers
			| DispatchApiChallengesPositions
			| DispatchApiChallengesPrices
		>
	) => {
		const api = getApiClient(chainId);
		console.log("Loading [REDUX]: ChallengesList");

		try {
			const response1 = await api.get("/challenges/list");
			dispatch(slice.actions.setList(response1.data as ApiChallengesListing));

			const responseMapping = await api.get("/challenges/mapping");
			dispatch(slice.actions.setMapping(responseMapping.data as ApiChallengesMapping));

			const response2 = await api.get("/challenges/challengers");
			dispatch(slice.actions.setChallengers(response2.data as ApiChallengesChallengers));

			const response3 = await api.get("/challenges/positions");
			dispatch(slice.actions.setPositions(response3.data as ApiChallengesPositions));

			const response4 = await api.get("/challenges/prices");
			dispatch(slice.actions.setPrices(response4.data as ApiChallengesPrices));
		} catch (error) {
			logApiError(error, "challenges data");
			dispatch(slice.actions.setList(undefined));
			dispatch(slice.actions.setMapping(undefined));
			dispatch(slice.actions.setChallengers(undefined));
			dispatch(slice.actions.setPositions(undefined));
			dispatch(slice.actions.setPrices(undefined));
		}

		// ---------------------------------------------------------------
		// Finalizing, loaded set to ture
		dispatch(slice.actions.setLoaded(true));
	};
