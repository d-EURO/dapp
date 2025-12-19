import { useMemo } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../redux/redux.store";
import { Address, erc20Abi } from "viem";
import { useReadContracts, useChainId, useAccount } from "wagmi";
import { ADDRESS, PositionV2ABI } from "@juicedollar/jusd";
import { usePositionMaxAmounts } from "./usePositionMaxAmounts";
import { PositionQuery } from "@juicedollar/api";
import { SolverPosition } from "../utils/positionSolver";

interface PositionManageData {
	position: PositionQuery | undefined;
	principal: bigint;
	positionPrice: bigint;
	collateralBalance: bigint;
	currentDebt: bigint;
	liqPrice: bigint;
	minimumCollateral: bigint;
	jusdAllowance: bigint;
	jusdBalance: bigint;
	walletBalance: bigint;
	priceDecimals: number;
	isInCooldown: boolean;
	cooldownRemainingFormatted: string | null;
	cooldownEndsAt: Date | undefined;
	currentPosition: SolverPosition | null;
	refetch: () => void;
	isLoading: boolean;
}

export const usePositionManageData = (addressQuery: string | string[] | undefined): PositionManageData => {
	const chainId = useChainId();
	const { address: userAddress } = useAccount();

	const positions = useSelector((state: RootState) => state.positions.list?.list || []);
	const position = positions.find((p) => p.position === addressQuery);

	const { walletBalance } = usePositionMaxAmounts(position);

	const { data, refetch, isLoading } = useReadContracts({
		contracts: position
			? [
					{ chainId, address: position.position, abi: PositionV2ABI, functionName: "principal" },
					{ chainId, address: position.position, abi: PositionV2ABI, functionName: "price" },
					{
						chainId,
						abi: erc20Abi,
						address: position.collateral as Address,
						functionName: "balanceOf",
						args: [position.position],
					},
					{ chainId, abi: PositionV2ABI, address: position.position, functionName: "getDebt" },
					{ chainId, address: position.position, abi: PositionV2ABI, functionName: "cooldown" },
					{ chainId, address: position.position, abi: PositionV2ABI, functionName: "minimumCollateral" },
					{
						chainId,
						abi: erc20Abi,
						address: ADDRESS[chainId]?.juiceDollar as Address,
						functionName: "allowance",
						args: [userAddress as Address, position.position as Address],
					},
					{
						chainId,
						abi: erc20Abi,
						address: ADDRESS[chainId]?.juiceDollar as Address,
						functionName: "balanceOf",
						args: [userAddress as Address],
					},
			  ]
			: [],
	});

	const principal = data?.[0]?.result || 0n;
	const positionPrice = data?.[1]?.result || 1n;
	const collateralBalance = data?.[2]?.result || 0n;
	const currentDebt = data?.[3]?.result || 0n;
	const cooldown = data?.[4]?.result || 0n;
	const minimumCollateral = data?.[5]?.result || 0n;
	const jusdAllowance = data?.[6]?.result || 0n;
	const jusdBalance = data?.[7]?.result || 0n;

	const collateralDecimals = position?.collateralDecimals || 18;
	const priceDecimals = 36 - collateralDecimals;
	const liqPrice = collateralBalance > 0n ? (currentDebt * BigInt(10 ** priceDecimals)) / collateralBalance : positionPrice;

	const now = BigInt(Math.floor(Date.now() / 1000));
	const cooldownBigInt = BigInt(cooldown);
	const isInCooldown = cooldownBigInt > now;
	const cooldownRemaining = isInCooldown ? Number(cooldownBigInt - now) : 0;
	const cooldownRemainingFormatted = isInCooldown
		? `${Math.floor(cooldownRemaining / 3600)}h ${Math.floor((cooldownRemaining % 3600) / 60)}m`
		: null;
	const cooldownEndsAt = isInCooldown ? new Date(Number(cooldownBigInt) * 1000) : undefined;

	const currentPosition: SolverPosition | null = useMemo(() => {
		if (!position) return null;
		return { collateral: collateralBalance, debt: currentDebt, liqPrice, expiration: position.expiration };
	}, [position, collateralBalance, currentDebt, liqPrice]);

	return {
		position,
		principal,
		positionPrice,
		collateralBalance,
		currentDebt,
		liqPrice,
		minimumCollateral,
		jusdAllowance,
		jusdBalance,
		walletBalance,
		priceDecimals,
		isInCooldown,
		cooldownRemainingFormatted,
		cooldownEndsAt,
		currentPosition,
		refetch,
		isLoading,
	};
};
