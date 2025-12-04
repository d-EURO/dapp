import { useEffect, useState } from "react";
import { useTranslation } from "next-i18next";

export interface AmountValidationParams {
	amount: string;
	isAdd: boolean;
	walletBalance?: bigint;
	currentBalance?: bigint;
	maxToRemove?: bigint;
	maxToBorrow?: bigint;
	symbol?: string;
	validationType: "collateral" | "loan";
}

export const useAmountValidation = (params: AmountValidationParams) => {
	const { t } = useTranslation();
	const [error, setError] = useState<string | null>(null);

	const {
		amount,
		isAdd,
		walletBalance = 0n,
		currentBalance = 0n,
		maxToRemove = 0n,
		maxToBorrow = 0n,
		symbol = "",
		validationType,
	} = params;

	useEffect(() => {
		if (!amount) {
			setError(null);
			return;
		}

		const amountBigInt = BigInt(amount);

		if (isAdd) {
			if (validationType === "collateral") {
				if (amountBigInt > walletBalance) {
					setError(t("common.error.insufficient_balance", { symbol }));
				} else {
					setError(null);
				}
			} else if (validationType === "loan") {
				if (amountBigInt > maxToBorrow) {
					setError(t("mint.error.amount_greater_than_max_to_borrow"));
				} else {
					setError(null);
				}
			}
		} else {
			if (validationType === "collateral") {
				if (amountBigInt > maxToRemove) {
					setError(t("mint.error.amount_greater_than_max_to_remove"));
				} else if (amountBigInt > currentBalance) {
					setError(t("mint.error.amount_greater_than_position_balance"));
				} else {
					setError(null);
				}
			} else if (validationType === "loan") {
				if (amountBigInt > walletBalance) {
					setError(t("common.error.insufficient_balance", { symbol }));
				} else if (amountBigInt > currentBalance) {
					setError(
						t("mint.error.amount_greater_than_debt", {
							amount: amount,
							symbol,
						})
					);
				} else {
					setError(null);
				}
			}
		}
	}, [amount, isAdd, walletBalance, currentBalance, maxToRemove, maxToBorrow, symbol, validationType, t]);

	return { error, setError };
};
