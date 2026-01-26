import { useMemo } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../redux/redux.store";
import { toDate, toTimestamp } from "@utils";
import { PositionQuery } from "@juicedollar/api";

interface ExtensionTargetResult {
	targetPositionForExtend: PositionQuery | undefined;
	canExtend: boolean;
}

export const useExtensionTarget = (position: PositionQuery | undefined, currentDebt?: bigint): ExtensionTargetResult => {
	const positions = useSelector((state: RootState) => state.positions.list?.list || []);
	const challenges = useSelector((state: RootState) => state.challenges.list?.list || []);
	const challengedPositions = challenges.filter((c) => c.status === "Active").map((c) => c.position);

	return useMemo(() => {
		if (!position) return { targetPositionForExtend: undefined, canExtend: false };

		const now = Date.now() / 1000;
		const currentExp = toTimestamp(toDate(position.expiration));
		const debt = currentDebt || 0n;

		const extendTargets = positions
			.filter((p) => {
				const exp = toTimestamp(toDate(p.expiration));
				const targetPrice = BigInt(p.price);
				const minCollateral = BigInt(p.minimumCollateral);
				const collateralNeeded = targetPrice > 0n ? (debt * BigInt(1e18)) / targetPrice : 0n;

				return (
					p.collateral.toLowerCase() === position.collateral.toLowerCase() &&
					!challengedPositions.includes(p.position) &&
					now > toTimestamp(toDate(p.cooldown)) &&
					now < exp &&
					!p.closed &&
					exp > currentExp &&
					BigInt(p.availableForClones) > 0n &&
					BigInt(p.availableForMinting) > 0n &&
					collateralNeeded >= minCollateral &&
					targetPrice >= BigInt(position.price)
				);
			})
			.sort((a, b) => toTimestamp(toDate(b.expiration)) - toTimestamp(toDate(a.expiration)));

		return {
			targetPositionForExtend: extendTargets[0],
			canExtend: extendTargets.length > 0,
		};
	}, [positions, challengedPositions, position, currentDebt]);
};
