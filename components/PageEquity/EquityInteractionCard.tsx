import React, { useState } from "react";
import { POOL_SHARE_TOKEN_SYMBOL, SAVINGS_VAULT_SYMBOL, TOKEN_SYMBOL } from "@utils";
import { useChainId } from "wagmi";
import { ADDRESS } from "@juicedollar/jusd";
import { useTranslation } from "next-i18next";
import { useWalletERC20Balances } from "../../hooks/useWalletBalances";
import { SelectAssetModal } from "./SelectAssetModal";
import InteractionStablecoinAndPoolShares from "./InteractionStablecoinAndPoolShares";
import InteractionStablecoinAndSavingVault from "./InteractionStablecoinAndSavingVault";
import InteractionSavingsVaultAndPoolShares from "./InteractionSavingsVaultAndPoolShares";


export enum TokenInteractionSide {
	INPUT = "input",
	OUTPUT = "output",
}

export const EquityTokenSelectorMapping: { [key: string]: string[] } = {
	[TOKEN_SYMBOL]: [POOL_SHARE_TOKEN_SYMBOL, SAVINGS_VAULT_SYMBOL],
	[POOL_SHARE_TOKEN_SYMBOL]: [TOKEN_SYMBOL, SAVINGS_VAULT_SYMBOL],
	[SAVINGS_VAULT_SYMBOL]: [TOKEN_SYMBOL, POOL_SHARE_TOKEN_SYMBOL],
};

export default function EquityInteractionCard() {
	const [tokenFromTo, setTokenFromTo] = useState<{ from: string; to: string }>({
		from: TOKEN_SYMBOL,
		to: POOL_SHARE_TOKEN_SYMBOL,
	});
	const [isOpenTokenSelector, setIsOpenTokenSelector] = useState(false);
	const [tokenInteractionSide, setTokenInteractionSide] = useState<TokenInteractionSide | undefined>(undefined);

	const chainId = useChainId();
	const { t } = useTranslation();

	const { balances, refetchBalances } = useWalletERC20Balances([
		{
			symbol: TOKEN_SYMBOL,
			name: TOKEN_SYMBOL,
			address: ADDRESS[chainId].juiceDollar,
		},
		{
			symbol: POOL_SHARE_TOKEN_SYMBOL,
			name: POOL_SHARE_TOKEN_SYMBOL,
			address: ADDRESS[chainId].equity,
		},
		{
			symbol: SAVINGS_VAULT_SYMBOL,
			name: SAVINGS_VAULT_SYMBOL,
			address: ADDRESS[chainId].savingsVaultJUSD,
		},
	]);

	const onTokenFromToChange = (newSelection: { from: string; to: string }) => {
		const toTokenOptions = EquityTokenSelectorMapping[newSelection.from];
		const isToTokenAvailable = toTokenOptions.includes(newSelection.to);
		const adjustedSelection = {
			from: newSelection.from,
			to: isToTokenAvailable ? newSelection.to : toTokenOptions[0],
		};
		setTokenFromTo(adjustedSelection);
	};

	const onTokenSelect = (symbol: string) => {
		if (tokenInteractionSide === TokenInteractionSide.INPUT) {
			onTokenFromToChange({ from: symbol, to: tokenFromTo.to });
		} else {
			onTokenFromToChange({ from: tokenFromTo.from, to: symbol });
		}
	};

	const handleOpenTokenSelector = (tokenInteractionSide: TokenInteractionSide) => {
		setTokenInteractionSide(tokenInteractionSide);
		setIsOpenTokenSelector(true);
	};

	const handleCloseTokenSelector = () => {
		setIsOpenTokenSelector(false);
		setTokenInteractionSide(undefined);
	};

	const handleReverseSelection = () => {
		onTokenFromToChange({ from: tokenFromTo.to, to: tokenFromTo.from });
	};

	const selectedFromToken = balances.find((balance) => balance.symbol === tokenFromTo.from);
	const selectedToToken = balances.find((balance) => balance.symbol === tokenFromTo.to);

	return (
		<>
			<div className="bg-card-body-primary shadow-card rounded-xl p-4 flex flex-col gap-8">
				<div className="justify-center items-center gap-1.5 inline-flex">
					<div className="text-text-title text-xl font-black ">
						{t("equity.pool_shares_title", { symbol: POOL_SHARE_TOKEN_SYMBOL })}
					</div>
				</div>

				{(tokenFromTo.from === TOKEN_SYMBOL && tokenFromTo.to === POOL_SHARE_TOKEN_SYMBOL) ||
				(tokenFromTo.from === POOL_SHARE_TOKEN_SYMBOL && tokenFromTo.to === TOKEN_SYMBOL) ? (
					<InteractionStablecoinAndPoolShares
						selectedFromToken={selectedFromToken}
						selectedToToken={selectedToToken}
						openSelector={handleOpenTokenSelector}
						reverseSelection={handleReverseSelection}
						refetchBalances={refetchBalances}
					/>
				) : null}
				{(tokenFromTo.from === TOKEN_SYMBOL && tokenFromTo.to === SAVINGS_VAULT_SYMBOL) ||
				(tokenFromTo.from === SAVINGS_VAULT_SYMBOL && tokenFromTo.to === TOKEN_SYMBOL) ? (
					<InteractionStablecoinAndSavingVault
						selectedFromToken={selectedFromToken}
						selectedToToken={selectedToToken}
						openSelector={handleOpenTokenSelector}
						reverseSelection={handleReverseSelection}
						refetchBalances={refetchBalances}
					/>
				) : null}
				{(tokenFromTo.from === SAVINGS_VAULT_SYMBOL && tokenFromTo.to === POOL_SHARE_TOKEN_SYMBOL) ||
				(tokenFromTo.from === POOL_SHARE_TOKEN_SYMBOL && tokenFromTo.to === SAVINGS_VAULT_SYMBOL) ? (
					<InteractionSavingsVaultAndPoolShares
						selectedFromToken={selectedFromToken}
						selectedToToken={selectedToToken}
						openSelector={handleOpenTokenSelector}
						reverseSelection={handleReverseSelection}
						refetchBalances={refetchBalances}
					/>
				) : null}
			</div>
			<SelectAssetModal
				title={"Select Asset"}
				isOpen={isOpenTokenSelector}
				setIsOpen={handleCloseTokenSelector}
				balances={balances}
				onTokenSelect={onTokenSelect}
			/>
		</>
	);
}
