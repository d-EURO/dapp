import { useAccount, useBlockNumber, useChainId } from "wagmi";
import { Address } from "viem";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { RootState, store } from "../redux/redux.store";
import { fetchPositionsList } from "../redux/slices/positions.slice";
import { fetchPricesList } from "../redux/slices/prices.slice";
import { fetchAccount, actions as accountActions } from "../redux/slices/account.slice";
import { useIsConnectedToCorrectChain } from "../hooks/useWalletConnectStats";
import { WAGMI_CHAIN } from "../app.config";
import LoadingScreen from "./LoadingScreen";
import { fetchChallengesList } from "../redux/slices/challenges.slice";
import { fetchBidsList } from "../redux/slices/bids.slice";
import { fetchEcosystem } from "../redux/slices/ecosystem.slice";
import { fetchSavings } from "../redux/slices/savings.slice";
import { getPublicViewAddress } from "../utils/url";
import { useRouter } from "next/router";

let initializing: boolean = false;
let initStart: number = 0;
let loading: boolean = false;

export default function BockUpdater({ children }: { children?: React.ReactElement | React.ReactElement[] }) {
	const chainId = useChainId() ?? WAGMI_CHAIN.id;
	const { error, data } = useBlockNumber({ chainId, watch: true });
	const { address: connectedAddress } = useAccount();
	const router = useRouter();
	const overwrite = getPublicViewAddress(router);
	const address = overwrite || connectedAddress;
	const isConnectedToCorrectChain = useIsConnectedToCorrectChain();

	const [initialized, setInitialized] = useState<boolean>(false);
	const [latestHeight, setLatestHeight] = useState<number>(0);
	const [latestHeight10, setLatestHeight10] = useState<number>(0);
	const [latestConnectedToChain, setLatestConnectedToChain] = useState<boolean>(false);
	const [latestAddress, setLatestAddress] = useState<Address | undefined>(undefined);

	const loadedEcosystem: boolean = useSelector((state: RootState) => state.ecosystem.loaded);
	const loadedPositions: boolean = useSelector((state: RootState) => state.positions.loaded);
	const loadedPrices: boolean = useSelector((state: RootState) => state.prices.loaded);
	const loadedChallenges: boolean = useSelector((state: RootState) => state.challenges.loaded);
	const loadedBids: boolean = useSelector((state: RootState) => state.bids.loaded);
	const loadedSavings: boolean = useSelector((state: RootState) => state.savings.loaded);

	// --------------------------------------------------------------------------------
	// Init
	useEffect(() => {
		if (initialized) return;
		if (initializing) return;
		initializing = true;
		initStart = Date.now();

		console.log(`Init [BlockUpdater]: Start loading application data... ${initStart}`);
		store.dispatch(fetchEcosystem(chainId));
		store.dispatch(fetchPositionsList(chainId));
		store.dispatch(fetchPricesList(chainId));
		store.dispatch(fetchChallengesList(chainId));
		store.dispatch(fetchBidsList(chainId));
		store.dispatch(fetchSavings(chainId, latestAddress));
	}, [initialized, latestAddress, chainId]);

	// --------------------------------------------------------------------------------
	// Init done
	useEffect(() => {
		if (initialized) return;
		if (loadedEcosystem && loadedPositions && loadedPrices && loadedChallenges && loadedBids && loadedSavings) {
			console.log(`Init [BlockUpdater]: Done. ${Date.now() - initStart} ms`);
			setInitialized(true);
		}
	}, [initialized, loadedPositions, loadedPrices, loadedEcosystem, loadedChallenges, loadedBids, loadedSavings]);

	// --------------------------------------------------------------------------------
	// Bock update policies
	useEffect(() => {
		if (!initialized) return;
		if (loading) return;

		// verify
		if (!data || error) return;
		const fetchedLatestHeight: number = parseInt(data.toString());

		// New block? set new state
		if (fetchedLatestHeight <= latestHeight) return;
		loading = true;
		setLatestHeight(fetchedLatestHeight);

		// Block update policy: EACH BLOCK
		console.log(`Policy [BlockUpdater]: EACH BLOCK ${fetchedLatestHeight}`);
		store.dispatch(fetchPositionsList(chainId));
		store.dispatch(fetchChallengesList(chainId));
		store.dispatch(fetchBidsList(chainId));
		store.dispatch(fetchAccount(latestAddress));
		store.dispatch(fetchSavings(chainId, latestAddress));
		store.dispatch(fetchPricesList(chainId));
		store.dispatch(fetchEcosystem(chainId));

		// Block update policy: EACH 10 BLOCKS
		if (fetchedLatestHeight >= latestHeight10 + 10) {
			console.log(`Policy [BlockUpdater]: EACH 10 BLOCKS ${fetchedLatestHeight}`);
			setLatestHeight10(fetchedLatestHeight);
		}

		// Unlock block updates
		loading = false;
	}, [initialized, error, data, latestHeight, latestHeight10, latestAddress, chainId]);

	// --------------------------------------------------------------------------------
	// Chain change: reset block state and refetch all data for new network
	useEffect(() => {
		if (!initialized) return;
		setLatestHeight(0);
		setLatestHeight10(0);
		console.log(`Policy [BlockUpdater]: Chain changed to ${chainId}, refetching API data`);
		store.dispatch(fetchEcosystem(chainId));
		store.dispatch(fetchPositionsList(chainId));
		store.dispatch(fetchPricesList(chainId));
		store.dispatch(fetchChallengesList(chainId));
		store.dispatch(fetchBidsList(chainId));
		store.dispatch(fetchSavings(chainId, latestAddress));
	}, [chainId, latestAddress]);

	// --------------------------------------------------------------------------------
	// Connected to correct chain changes
	useEffect(() => {
		if (isConnectedToCorrectChain !== latestConnectedToChain) {
			console.log(`Policy [BlockUpdater]: Connected to correct chain changed: ${isConnectedToCorrectChain}`);
			setLatestConnectedToChain(isConnectedToCorrectChain);
		}
	}, [isConnectedToCorrectChain, latestConnectedToChain]);

	// --------------------------------------------------------------------------------
	// Address / User changes
	useEffect(() => {
		if (!address && latestAddress) {
			setLatestAddress(undefined);
			console.log(`Policy [BlockUpdater]: Address reset`);
			store.dispatch(accountActions.resetAccountState());
			store.dispatch(fetchSavings(chainId, undefined));
		} else if (address && (!latestAddress || address != latestAddress)) {
			setLatestAddress(address as `0x${string}`);
			console.log(`Policy [BlockUpdater]: Address changed to: ${address}`);
			store.dispatch(fetchAccount(address as `0x${string}`));
			store.dispatch(fetchSavings(chainId, address as `0x${string}`));
		}
	}, [address, latestAddress, chainId]);

	// --------------------------------------------------------------------------------
	// Loading Guard
	if (initialized) {
		return <>{children}</>;
	} else {
		return <LoadingScreen />;
	}
}
