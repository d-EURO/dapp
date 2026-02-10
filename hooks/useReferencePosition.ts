import { useMemo, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useChainId } from "wagmi";
import { RootState, AppDispatch } from "../redux/redux.store";
import { Address } from "viem";
import { PositionQuery } from "@juicedollar/api";
import { getApiClient } from "@utils";
import { slice } from "../redux/slices/positions.slice";

type ReferencePositionResult = {
	address: Address | null;
	price: bigint;
	defaultPosition: PositionQuery | null | undefined;
	isLoading: boolean;
};

export const useReferencePosition = (currentPosition?: PositionQuery, currentPrice?: bigint): ReferencePositionResult => {
	const chainId = useChainId();
	const dispatch = useDispatch<AppDispatch>();
	const defaultPosition = useSelector((state: RootState) => state.positions.defaultPosition);

	useEffect(() => {
		if (chainId === undefined || defaultPosition !== undefined) return;

		const fetchDefaultPosition = async () => {
			try {
				const api = getApiClient(chainId);
				const response = await api.get<PositionQuery>("/positions/default");
				const position = response.data as PositionQuery;
				dispatch(slice.actions.setDefaultPosition(position));
			} catch (error) {
				console.error("Error fetching default position:", error);
				dispatch(slice.actions.setDefaultPosition(null));
			}
		};

		fetchDefaultPosition();
	}, [chainId, defaultPosition, dispatch]);

	return useMemo(() => {
		const isLoading = defaultPosition === undefined;

		if (!currentPosition || currentPrice === undefined) {
			return { address: null, price: 0n, defaultPosition, isLoading };
		}

		if (
			defaultPosition &&
			defaultPosition.collateral.toLowerCase() === currentPosition.collateral.toLowerCase() &&
			BigInt(defaultPosition.price) > currentPrice &&
			defaultPosition.principal
		) {
			return {
				address: defaultPosition.position as Address,
				price: BigInt(defaultPosition.price),
				defaultPosition,
				isLoading,
			};
		}

		return { address: null, price: 0n, defaultPosition, isLoading };
	}, [currentPosition, currentPrice, defaultPosition]);
};
