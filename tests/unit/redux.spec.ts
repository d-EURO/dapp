import { test, expect } from "@playwright/test";
import { reducer as prefs, actions as prefActions, initialState as prefsInitial } from "../../redux/slices/globalPreferences.slice";
import { reducer as account, actions as accountActions, initialState as accountInitial } from "../../redux/slices/account.slice";
import { reducer as positions, actions as positionActions, initialState as positionsInitial } from "../../redux/slices/positions.slice";
import { reducer as savings, actions as savingsActions, initialState as savingsInitial } from "../../redux/slices/savings.slice";
import { reducer as ecosystem, actions as ecosystemActions, initialState as ecosystemInitial } from "../../redux/slices/ecosystem.slice";
import { reducer as challenges, actions as challengeActions, initialState as challengesInitial } from "../../redux/slices/challenges.slice";
import { reducer as bids, actions as bidActions, initialState as bidsInitial } from "../../redux/slices/bids.slice";
import { reducer as prices, actions as priceActions, initialState as pricesInitial } from "../../redux/slices/prices.slice";
import { reducer as referrals, actions as referralActions } from "../../redux/slices/myReferrals.slice";

test.describe("redux reducers", () => {
	test("globalPreferences toggle", () => {
		const next = prefs(prefsInitial, prefActions.toggleExpertMode());
		expect(next.expertMode).toBe(!prefsInitial.expertMode);
		const back = prefs(next, prefActions.toggleExpertMode());
		expect(back.expertMode).toBe(prefsInitial.expertMode);
	});

	test("account error/loading/reset", () => {
		const err = account(accountInitial, accountActions.hasError("boom"));
		expect(err.error).toBe("boom");
		const loading = account(err, accountActions.setLoading(true));
		expect(loading.loading).toBe(true);
		const reset = account(loading, accountActions.resetAccountState());
		expect(reset).toEqual(loading);
	});

	test("positions setters", () => {
		let state = positions(positionsInitial, positionActions.hasError("e"));
		state = positions(state, positionActions.setLoaded(true));
		state = positions(state, positionActions.setList({ positions: [] } as never));
		state = positions(state, positionActions.setListMapping({} as never));
		state = positions(state, positionActions.setRequestsList({} as never));
		state = positions(state, positionActions.setOwnersPositions({} as never));
		state = positions(state, positionActions.setOpenPositions([{ position: "0x1" } as never]));
		state = positions(state, positionActions.setClosedPositions([]));
		state = positions(state, positionActions.setDeniedPositions([]));
		state = positions(state, positionActions.setOriginalPositions([]));
		state = positions(state, positionActions.setOpenPositionsByOriginal([[]]));
		state = positions(state, positionActions.setOpenPositionsByCollateral([[]]));
		expect(state.loaded).toBe(true);
		expect(state.openPositions).toHaveLength(1);
		expect(state.error).toBe("e");
	});

	test("savings / ecosystem / challenges / bids / prices / referrals setters", () => {
		expect(savings(savingsInitial, savingsActions.setLoaded(true)).loaded).toBe(true);
		expect(savings(savingsInitial, savingsActions.hasError("x")).error).toBe("x");
		expect(savings(savingsInitial, savingsActions.setLeadrateInfo({} as never)).leadrateInfo).toBeTruthy();
		expect(savings(savingsInitial, savingsActions.setLeadrateProposed({} as never)).leadrateProposed).toBeTruthy();
		expect(savings(savingsInitial, savingsActions.setLeadrateRate({} as never)).leadrateRate).toBeTruthy();
		expect(savings(savingsInitial, savingsActions.setSavingsInfo({} as never)).savingsInfo).toBeTruthy();

		expect(ecosystem(ecosystemInitial, ecosystemActions.setLoaded(true)).loaded).toBe(true);
		expect(ecosystem(ecosystemInitial, ecosystemActions.hasError("e")).error).toBe("e");
		expect(ecosystem(ecosystemInitial, ecosystemActions.setCollateralPositions({} as never)).collateralPositions).toBeTruthy();
		expect(ecosystem(ecosystemInitial, ecosystemActions.setCollateralStats({} as never)).collateralStats).toBeTruthy();
		expect(ecosystem(ecosystemInitial, ecosystemActions.setDepsInfo({} as never)).depsInfo).toBeTruthy();

		expect(challenges(challengesInitial, challengeActions.setLoaded(true)).loaded).toBe(true);
		expect(challenges(challengesInitial, challengeActions.hasError("e")).error).toBe("e");

		expect(bids(bidsInitial, bidActions.setLoaded(true)).loaded).toBe(true);
		expect(bids(bidsInitial, bidActions.hasError("e")).error).toBe("e");
		expect(bids(bidsInitial, bidActions.setList({} as never)).list).toBeTruthy();

		expect(prices(pricesInitial, priceActions.setLoaded(true)).loaded).toBe(true);
		expect(prices(pricesInitial, priceActions.hasError("e")).error).toBe("e");
		expect(prices(pricesInitial, priceActions.setListMapping({} as never)).coingecko).toBeTruthy();
		expect(prices(pricesInitial, priceActions.setMintERC20Info({} as never)).mint).toBeTruthy();

		const ref = referrals(undefined, referralActions.setLoaded(true));
		expect(ref.loaded).toBe(true);
		expect(referrals(ref, referralActions.hasError("e")).error).toBe("e");
		expect(referrals(ref, referralActions.setMyReferralName("bob")).myReferralName).toBe("bob");
		expect(referrals(ref, referralActions.setMyReferralLink("https://x")).myReferralLink).toBe("https://x");
		expect(referrals(ref, referralActions.setReferralData({ myReferralCount: 3 } as never)).myReferralCount).toBe(3);
	});
});
