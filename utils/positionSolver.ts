import { Target } from "@components/PageMint/AdjustPosition";

export { Target };

export enum Strategy {
	KEEP_LOAN = "KEEP_LOAN",
	KEEP_LIQ_PRICE = "KEEP_LIQ_PRICE",
	KEEP_COLLATERAL = "KEEP_COLLATERAL",
	DATE_ONLY = "DATE_ONLY",
}

export enum TxAction {
	DEPOSIT = "DEPOSIT",
	WITHDRAW = "WITHDRAW",
	BORROW = "BORROW",
	REPAY = "REPAY",
	UPDATE_EXPIRATION = "UPDATE_EXPIRATION",
}

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

	if (target === Target.EXPIRATION) {
		return {
			next: { ...pos, expiration: Number(newValue) },
			deltaCollateral: 0n,
			deltaDebt: 0n,
			deltaLiqPrice: 0n,
			txPlan: [TxAction.UPDATE_EXPIRATION],
			isValid: true,
		};
	}

	if (currentDebt === 0n || currentDebt < 1000n) {
		if (target === Target.COLLATERAL) {
			const newCollateral = BigInt(newValue as bigint);

			return {
				next: { ...pos, collateral: newCollateral },
				deltaCollateral: newCollateral - currentCollateral,
				deltaDebt: 0n,
				deltaLiqPrice: 0n,
				txPlan: newCollateral < currentCollateral ? [TxAction.WITHDRAW] : [TxAction.DEPOSIT],
				isValid: true,
			};
		}

		if (target === Target.LOAN && BigInt(newValue) > 0n) {
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
				txPlan: [TxAction.BORROW],
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

		if (target === Target.COLLATERAL) {
			newCollateral = BigInt(newValue as bigint);

			if (newCollateral === 0n && currentDebt > 0n) {
				if (strategy === Strategy.KEEP_LOAN) {
					throw new Error("Must repay debt before withdrawing all collateral");
				}
			}

			if (newCollateral < 0n) throw new Error("Collateral cannot be negative");

			if (strategy === Strategy.KEEP_LOAN) {
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
		} else if (target === Target.LIQ_PRICE) {
			newLiqPrice = BigInt(newValue as bigint);
			if (newLiqPrice <= 0n) throw new Error("Liquidation price must be positive");

			if (strategy === Strategy.KEEP_LOAN) {
				newDebt = currentDebt;
				newCollateral = (k * newDebt) / newLiqPrice;
			} else {
				newCollateral = currentCollateral;
				newDebt = (newLiqPrice * newCollateral) / k;
			}
		} else if (target === Target.LOAN) {
			newDebt = BigInt(newValue as bigint);
			if (newDebt < 0n) throw new Error("Loan cannot be negative");

			if (strategy === Strategy.KEEP_LIQ_PRICE) {
				newLiqPrice = currentLiqPrice;
				const baseCollateral = (k * newDebt) / newLiqPrice;
				newCollateral = baseCollateral + baseCollateral / 100n;
			} else {
				newCollateral = currentCollateral;
				newLiqPrice = (k * newDebt) / newCollateral;
			}
		}

		const deltaCollateral = newCollateral - currentCollateral;
		const deltaDebt = newDebt - currentDebt;
		const txPlan: TxAction[] = [];
		if (deltaCollateral > 0n) txPlan.push(TxAction.DEPOSIT);
		if (deltaCollateral < 0n) txPlan.push(TxAction.WITHDRAW);
		if (deltaDebt > 0n) txPlan.push(TxAction.BORROW);
		if (deltaDebt < 0n) txPlan.push(TxAction.REPAY);

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
	if (target === Target.EXPIRATION) {
		return [
			{
				strategy: Strategy.DATE_ONLY,
				label: "Extend expiration",
				description: "Pay interest to extend loan",
				consequence: "Interest payment required",
			},
		];
	}

	const strategies = {
		[Target.COLLATERAL]: {
			increase: [
				{
					strategy: Strategy.KEEP_LOAN,
					label: "Keep loan constant",
					description: "Add collateral only",
					consequence: "Lower liquidation price (safer)",
				},
				{
					strategy: Strategy.KEEP_LIQ_PRICE,
					label: "Keep price constant",
					description: "Add collateral & borrow more",
					consequence: "Loan increases",
				},
			],
			decrease: [
				{
					strategy: Strategy.KEEP_LOAN,
					label: "Keep loan constant",
					description: "Remove collateral only",
					consequence: "Higher liquidation price (riskier)",
				},
				{
					strategy: Strategy.KEEP_LIQ_PRICE,
					label: "Keep price constant",
					description: "Remove collateral & repay",
					consequence: "Loan decreases",
				},
			],
		},
		[Target.LIQ_PRICE]: {
			increase: [
				{
					strategy: Strategy.KEEP_LOAN,
					label: "Keep loan constant",
					description: "Remove collateral",
					consequence: "Collateral decreases",
				},
				{
					strategy: Strategy.KEEP_COLLATERAL,
					label: "Keep collateral constant",
					description: "Borrow more",
					consequence: "Loan increases",
				},
			],
			decrease: [
				{
					strategy: Strategy.KEEP_LOAN,
					label: "Keep loan constant",
					description: "Add collateral",
					consequence: "Collateral increases",
				},
				{
					strategy: Strategy.KEEP_COLLATERAL,
					label: "Keep collateral constant",
					description: "Repay loan",
					consequence: "Loan decreases",
				},
			],
		},
		[Target.LOAN]: {
			increase: [
				{
					strategy: Strategy.KEEP_LIQ_PRICE,
					label: "Keep price constant",
					description: "Add collateral",
					consequence: "Collateral increases",
				},
				{
					strategy: Strategy.KEEP_COLLATERAL,
					label: "Keep collateral constant",
					description: "Borrow more",
					consequence: "Higher liquidation price (riskier)",
				},
			],
			decrease: [
				{
					strategy: Strategy.KEEP_LIQ_PRICE,
					label: "Keep price constant",
					description: "Remove collateral",
					consequence: "Collateral decreases",
				},
				{
					strategy: Strategy.KEEP_COLLATERAL,
					label: "Keep collateral constant",
					description: "Repay loan",
					consequence: "Lower liquidation price (safer)",
				},
			],
		},
	};

	return strategies[target]?.[isIncrease ? "increase" : "decrease"] || [];
}
