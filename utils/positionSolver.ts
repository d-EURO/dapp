export type Target = "COLLATERAL" | "LIQ_PRICE" | "LOAN" | "EXPIRATION";
export type Strategy = "KEEP_LOAN" | "KEEP_LIQ_PRICE" | "KEEP_COLLATERAL" | "DATE_ONLY";
export type TxAction = "DEPOSIT" | "WITHDRAW" | "BORROW" | "REPAY" | "UPDATE_EXPIRATION";

export interface SolverPosition {
	collateral: bigint;
	debt: bigint;
	liqPrice: bigint;
	expiration: number;
}

export interface SolverOutcome {
	next: SolverPosition;
	deltaCollateral: bigint;
	deltaDebt: bigint;
	deltaLiqPrice: bigint;
	txPlan: TxAction[];
	isValid: boolean;
	errorMessage?: string;
}

//Core solver: calculates what changes are needed for a position adjustment
export function solveManage(pos: SolverPosition, target: Target, strategy: Strategy, newValue: bigint | number): SolverOutcome {
	const { collateral: currentCollateral, debt: currentDebt, liqPrice: currentLiqPrice, expiration } = pos;

	// Expiration - special case
	if (target === "EXPIRATION") {
		return {
			next: { ...pos, expiration: Number(newValue) },
			deltaCollateral: 0n,
			deltaDebt: 0n,
			deltaLiqPrice: 0n,
			txPlan: ["UPDATE_EXPIRATION"],
			isValid: true,
		};
	}

	if (currentDebt === 0n || currentDebt < 1000n) {
		if (target === "COLLATERAL") {
			const newCollateral = BigInt(newValue as bigint);

			return {
				next: { ...pos, collateral: newCollateral },
				deltaCollateral: newCollateral - currentCollateral,
				deltaDebt: 0n,
				deltaLiqPrice: 0n,
				txPlan: newCollateral < currentCollateral ? ["WITHDRAW"] : ["DEPOSIT"],
				isValid: true,
			};
		}

		if (target === "LOAN" && BigInt(newValue) > 0n) {
			const newDebt = BigInt(newValue);

			return {
				next: {
					...pos,
					debt: newDebt,
					collateral: currentCollateral,
					liqPrice: currentLiqPrice,
				},
				deltaCollateral: 0n,
				deltaDebt: newDebt,
				deltaLiqPrice: 0n,
				txPlan: ["BORROW"],
				isValid: true,
			};
		}

		return {
			next: pos,
			deltaCollateral: 0n,
			deltaDebt: 0n,
			deltaLiqPrice: 0n,
			txPlan: [],
			isValid: false,
			errorMessage: "Cannot adjust price when debt is zero",
		};
	}

	try {
		const k = (currentLiqPrice * currentCollateral) / currentDebt;
		let newCollateral = currentCollateral;
		let newDebt = currentDebt;
		let newLiqPrice = currentLiqPrice;

		if (target === "COLLATERAL") {
			newCollateral = BigInt(newValue as bigint);

			if (newCollateral === 0n && currentDebt > 0n) {
				if (strategy === "KEEP_LOAN") {
					throw new Error("Must repay debt before withdrawing all collateral");
				}
			}

			if (newCollateral < 0n) throw new Error("Collateral cannot be negative");

			if (strategy === "KEEP_LOAN") {
				newDebt = currentDebt;
				if (newCollateral > 0n) {
					const calculatedPrice = (currentLiqPrice * currentCollateral) / newCollateral;
					const safetyMargin = calculatedPrice / 100n;
					newLiqPrice = calculatedPrice + safetyMargin;
				}
			} else {
				newLiqPrice = currentLiqPrice;
				if (newCollateral === 0n && currentDebt > 0n) {
					newDebt = 0n;
				} else {
					newDebt = (newLiqPrice * newCollateral) / k;
				}
			}
		} else if (target === "LIQ_PRICE") {
			newLiqPrice = BigInt(newValue as bigint);
			if (newLiqPrice <= 0n) throw new Error("Liquidation price must be positive");

			if (strategy === "KEEP_LOAN") {
				newDebt = currentDebt;
				newCollateral = (k * newDebt) / newLiqPrice;
			} else {
				newCollateral = currentCollateral;
				newDebt = (newLiqPrice * newCollateral) / k;
			}
		} else if (target === "LOAN") {
			newDebt = BigInt(newValue as bigint);
			if (newDebt < 0n) throw new Error("Loan cannot be negative");

			if (strategy === "KEEP_LIQ_PRICE") {
				newLiqPrice = currentLiqPrice;
				newCollateral = (k * newDebt) / newLiqPrice;
			} else {
				newCollateral = currentCollateral;
				newLiqPrice = (k * newDebt) / newCollateral;
			}
		}

		const deltaCollateral = newCollateral - currentCollateral;
		const deltaDebt = newDebt - currentDebt;
		const txPlan: TxAction[] = [];
		if (deltaCollateral > 0n) txPlan.push("DEPOSIT");
		if (deltaCollateral < 0n) txPlan.push("WITHDRAW");
		if (deltaDebt > 0n) txPlan.push("BORROW");
		if (deltaDebt < 0n) txPlan.push("REPAY");

		return {
			next: { collateral: newCollateral, debt: newDebt, liqPrice: newLiqPrice, expiration },
			deltaCollateral,
			deltaDebt,
			deltaLiqPrice: newLiqPrice - currentLiqPrice,
			txPlan,
			isValid: true,
		};
	} catch (error) {
		return {
			next: pos,
			deltaCollateral: 0n,
			deltaDebt: 0n,
			deltaLiqPrice: 0n,
			txPlan: [],
			isValid: false,
			errorMessage: error instanceof Error ? error.message : "Calculation error",
		};
	}
}

//Get strategy options for a target parameter
export function getStrategiesForTarget(target: Target, isIncrease: boolean) {
	if (target === "EXPIRATION") {
		return [
			{
				strategy: "DATE_ONLY" as Strategy,
				label: "Extend expiration",
				description: "Pay interest to extend loan",
				consequence: "Interest payment required",
			},
		];
	}

	const strategies = {
		COLLATERAL: {
			increase: [
				{
					strategy: "KEEP_LOAN" as Strategy,
					label: "Keep loan constant",
					description: "Add collateral only",
					consequence: "Lower liquidation price (safer)",
				},
				{
					strategy: "KEEP_LIQ_PRICE" as Strategy,
					label: "Keep price constant",
					description: "Add collateral & borrow more",
					consequence: "Loan increases",
				},
			],
			decrease: [
				{
					strategy: "KEEP_LOAN" as Strategy,
					label: "Keep loan constant",
					description: "Remove collateral only",
					consequence: "Higher liquidation price (riskier)",
				},
				{
					strategy: "KEEP_LIQ_PRICE" as Strategy,
					label: "Keep price constant",
					description: "Remove collateral & repay",
					consequence: "Loan decreases",
				},
			],
		},
		LIQ_PRICE: {
			increase: [
				{
					strategy: "KEEP_LOAN" as Strategy,
					label: "Keep loan constant",
					description: "Remove collateral",
					consequence: "Collateral decreases",
				},
				{
					strategy: "KEEP_COLLATERAL" as Strategy,
					label: "Keep collateral constant",
					description: "Borrow more",
					consequence: "Loan increases",
				},
			],
			decrease: [
				{
					strategy: "KEEP_LOAN" as Strategy,
					label: "Keep loan constant",
					description: "Add collateral",
					consequence: "Collateral increases",
				},
				{
					strategy: "KEEP_COLLATERAL" as Strategy,
					label: "Keep collateral constant",
					description: "Repay loan",
					consequence: "Loan decreases",
				},
			],
		},
		LOAN: {
			increase: [
				{
					strategy: "KEEP_LIQ_PRICE" as Strategy,
					label: "Keep price constant",
					description: "Add collateral",
					consequence: "Collateral increases",
				},
				{
					strategy: "KEEP_COLLATERAL" as Strategy,
					label: "Keep collateral constant",
					description: "Borrow more",
					consequence: "Higher liquidation price (riskier)",
				},
			],
			decrease: [
				{
					strategy: "KEEP_LIQ_PRICE" as Strategy,
					label: "Keep price constant",
					description: "Remove collateral",
					consequence: "Collateral decreases",
				},
				{
					strategy: "KEEP_COLLATERAL" as Strategy,
					label: "Keep collateral constant",
					description: "Repay loan",
					consequence: "Lower liquidation price (safer)",
				},
			],
		},
	};

	return strategies[target]?.[isIncrease ? "increase" : "decrease"] || [];
}
