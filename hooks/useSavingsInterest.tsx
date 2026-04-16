import { useAccount, useBlockNumber, useChainId } from "wagmi";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { gql, useQuery } from "@apollo/client";
import { Address, erc20Abi, formatUnits, zeroAddress } from "viem";
import { toast } from "react-toastify";
import { readContract, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { WAGMI_CONFIG } from "../app.config";
import { useFrontendCode } from "./useFrontendCode";
import { getPublicViewAddress, formatCurrency, TOKEN_SYMBOL } from "@utils";
import { renderErrorTxToast, TxToast } from "@components/TxToast";
import { getAppAddresses, isDeployed, SavingsGatewayV2ABI, SavingsV3ABI, SavingsVaultDEUROABI } from "@contracts";

export const useSavingsInterest = () => {
	const [isLoaded, setLoaded] = useState(false);
	const [v2SavingsBalance, setV2SavingsBalance] = useState(0n);
	const [v3SavingsBalance, setV3SavingsBalance] = useState(0n);
	const [v2Interest, setV2Interest] = useState(0n);
	const [v3Interest, setV3Interest] = useState(0n);
	const [isNonCompounding, setIsNonCompounding] = useState(false);
	const [v3ClaimableInterest, setV3ClaimableInterest] = useState(0n);
	const [v2VaultShares, setV2VaultShares] = useState(0n);
	const [v3VaultShares, setV3VaultShares] = useState(0n);
	const [v2VaultAssets, setV2VaultAssets] = useState(0n);
	const [v3VaultAssets, setV3VaultAssets] = useState(0n);
	const [isClaiming, setIsClaiming] = useState(false);
	const [isReinvesting, setIsReinvesting] = useState(false);
	const [refetchSignal, setRefetchSignal] = useState(0);

	const { data } = useBlockNumber({ watch: true });
	const { address } = useAccount();
	const chainId = useChainId();
	const router = useRouter();
	const overwrite = getPublicViewAddress(router);
	const account = (overwrite || address || zeroAddress) as Address;
	const ADDR = getAppAddresses(chainId);

	const { frontendCode } = useFrontendCode();

	const v3Deployed = isDeployed(ADDR.savings);
	const v2VaultDeployed = isDeployed(ADDR.savingsVaultV2);
	const v3VaultDeployed = isDeployed(ADDR.savingsVaultV3);

	const { data: leaderboardData, refetch: refetchLeaderboard } = useQuery(
		gql`
			{
				savingsUserLeaderboard(id: "${account}") {
					interestReceived
				}
			}
		`,
		{
			pollInterval: 0,
			skip: !account || account === zeroAddress,
		},
	);

	const totalEarnedInterest = BigInt(leaderboardData?.savingsUserLeaderboard?.interestReceived || 0n);

	useEffect(() => {
		if (account === zeroAddress || isClaiming) return;

		(async () => {
			let nextV2Balance = 0n;
			let nextV2Interest = 0n;
			let nextV3Balance = 0n;
			let nextV3Interest = 0n;
			let nextV3Claimable = 0n;
			let nextIsNonCompounding = false;
			let nextV2VaultShares = 0n;
			let nextV2VaultAssets = 0n;
			let nextV3VaultShares = 0n;
			let nextV3VaultAssets = 0n;

			try {
				const [_saved] = await readContract(WAGMI_CONFIG, {
					address: ADDR.savingsGateway,
					abi: SavingsGatewayV2ABI,
					functionName: "savings",
					args: [account],
				});
				nextV2Balance = _saved;

				nextV2Interest = await readContract(WAGMI_CONFIG, {
					address: ADDR.savingsGateway,
					abi: SavingsGatewayV2ABI,
					functionName: "accruedInterest",
					args: [account],
				});
			} catch {
				// Ignore V2 read failures so V3 can still render.
			}

			if (v3Deployed) {
				try {
					const [_saved] = await readContract(WAGMI_CONFIG, {
						address: ADDR.savings,
						abi: SavingsV3ABI,
						functionName: "savings",
						args: [account],
					});
					nextV3Balance = _saved;
					nextV3Interest = await readContract(WAGMI_CONFIG, {
						address: ADDR.savings,
						abi: SavingsV3ABI,
						functionName: "accruedInterest",
						args: [account],
					});
					nextIsNonCompounding = await readContract(WAGMI_CONFIG, {
						address: ADDR.savings,
						abi: SavingsV3ABI,
						functionName: "nonCompounding",
						args: [account],
					});
					nextV3Claimable = await readContract(WAGMI_CONFIG, {
						address: ADDR.savings,
						abi: SavingsV3ABI,
						functionName: "claimableInterest",
						args: [account],
					});
				} catch {
					// Ignore V3 read failures so legacy balances can still render.
				}
			}

			if (v2VaultDeployed) {
				try {
					nextV2VaultShares = await readContract(WAGMI_CONFIG, {
						address: ADDR.savingsVaultV2,
						abi: erc20Abi,
						functionName: "balanceOf",
						args: [account],
					});

					if (nextV2VaultShares > 0n) {
						nextV2VaultAssets = await readContract(WAGMI_CONFIG, {
							address: ADDR.savingsVaultV2,
							abi: SavingsVaultDEUROABI,
							functionName: "convertToAssets",
							args: [nextV2VaultShares],
						});
					}
				} catch {
					// Ignore V2 vault read failures.
				}
			}

			if (v3VaultDeployed) {
				try {
					nextV3VaultShares = await readContract(WAGMI_CONFIG, {
						address: ADDR.savingsVaultV3,
						abi: erc20Abi,
						functionName: "balanceOf",
						args: [account],
					});

					if (nextV3VaultShares > 0n) {
						nextV3VaultAssets = await readContract(WAGMI_CONFIG, {
							address: ADDR.savingsVaultV3,
							abi: SavingsVaultDEUROABI,
							functionName: "convertToAssets",
							args: [nextV3VaultShares],
						});
					}
				} catch {
					// Ignore V3 vault read failures.
				}
			}

			setV2SavingsBalance(nextV2Balance);
			setV2Interest(nextV2Interest);
			setV3SavingsBalance(nextV3Balance);
			setV3Interest(nextV3Interest);
			setIsNonCompounding(nextIsNonCompounding);
			setV3ClaimableInterest(nextV3Claimable);
			setV2VaultShares(nextV2VaultShares);
			setV2VaultAssets(nextV2VaultAssets);
			setV3VaultShares(nextV3VaultShares);
			setV3VaultAssets(nextV3VaultAssets);
			setLoaded(true);
		})();
	}, [data, account, ADDR.savingsGateway, ADDR.savings, ADDR.savingsVaultV2, ADDR.savingsVaultV3, isClaiming, refetchSignal, v2VaultDeployed, v3Deployed, v3VaultDeployed]);

	useEffect(() => {
		setLoaded(false);
	}, [account]);

	const refetchInterest = async () => {
		setRefetchSignal((prev) => prev + 1);
		await refetchLeaderboard();
	};

	const claimInterest = async () => {
		if (!address) return;

		try {
			setIsClaiming(true);

			if (v2Interest > 0n && v2SavingsBalance > 0n) {
				const v2Hash = await writeContract(WAGMI_CONFIG, {
					address: ADDR.savingsGateway,
					abi: SavingsGatewayV2ABI,
					functionName: "adjust",
					args: [v2SavingsBalance, frontendCode],
				});

				const v2ToastContent = [
					{
						title: "Claim Interest: ",
						value: `${formatCurrency(formatUnits(v2Interest, 18))} ${TOKEN_SYMBOL}`,
					},
					{
						title: "Transaction: ",
						hash: v2Hash,
					},
				];

				await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: v2Hash, confirmations: 2 }), {
					pending: { render: <TxToast title="Claiming V2 interest..." rows={v2ToastContent} /> },
					success: { render: <TxToast title="V2 interest claimed" rows={v2ToastContent} /> },
				});
			}

			if (v3Deployed && (v3Interest > 0n || v3ClaimableInterest > 0n)) {
				const v3Amount = v3Interest + v3ClaimableInterest;
				const v3Hash = isNonCompounding
					? await writeContract(WAGMI_CONFIG, {
							address: ADDR.savings,
							abi: SavingsV3ABI,
							functionName: "claimInterest",
							args: [address],
						})
					: await writeContract(WAGMI_CONFIG, {
							address: ADDR.savings,
							abi: SavingsV3ABI,
							functionName: "refreshBalance",
							args: [address],
						});

				const v3ToastContent = [
					{
						title: "Claim Interest: ",
						value: `${formatCurrency(formatUnits(v3Amount, 18))} ${TOKEN_SYMBOL}`,
					},
					{
						title: "Transaction: ",
						hash: v3Hash,
					},
				];

				await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: v3Hash, confirmations: 2 }), {
					pending: { render: <TxToast title="Claiming interest..." rows={v3ToastContent} /> },
					success: { render: <TxToast title="Successfully claimed" rows={v3ToastContent} /> },
				});
			}

			await refetchInterest();
		} catch (error) {
			toast.error(renderErrorTxToast(error));
		} finally {
			setLoaded(false);
			setIsClaiming(false);
		}
	};

	const handleReinvest = async () => {
		if (!address) return;

		try {
			setIsReinvesting(true);

			if (v2Interest > 0n) {
				const v2Hash = await writeContract(WAGMI_CONFIG, {
					address: ADDR.savingsGateway,
					abi: SavingsGatewayV2ABI,
					functionName: "refreshBalance",
					args: [address],
				});

				const v2ToastContent = [
					{
						title: "Reinvested amount: ",
						value: `${formatCurrency(formatUnits(v2Interest, 18))} ${TOKEN_SYMBOL}`,
					},
					{
						title: "Transaction: ",
						hash: v2Hash,
					},
				];

				await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: v2Hash, confirmations: 2 }), {
					pending: { render: <TxToast title="Reinvesting V2 interest..." rows={v2ToastContent} /> },
					success: { render: <TxToast title="V2 interest reinvested" rows={v2ToastContent} /> },
				});
			}

			if (v3Deployed && !isNonCompounding && v3Interest > 0n) {
				const v3Hash = await writeContract(WAGMI_CONFIG, {
					address: ADDR.savings,
					abi: SavingsV3ABI,
					functionName: "refreshBalance",
					args: [address],
				});

				const v3ToastContent = [
					{
						title: "Reinvested amount: ",
						value: `${formatCurrency(formatUnits(v3Interest, 18))} ${TOKEN_SYMBOL}`,
					},
					{
						title: "Transaction: ",
						hash: v3Hash,
					},
				];

				await toast.promise(waitForTransactionReceipt(WAGMI_CONFIG, { hash: v3Hash, confirmations: 2 }), {
					pending: { render: <TxToast title="Reinvesting..." rows={v3ToastContent} /> },
					success: { render: <TxToast title="Successfully reinvested" rows={v3ToastContent} /> },
				});
			}

			await refetchInterest();
		} catch (error) {
			toast.error(renderErrorTxToast(error));
		} finally {
			setIsReinvesting(false);
		}
	};

	const userSavingsBalance = v2SavingsBalance + v3SavingsBalance + v2VaultAssets + v3VaultAssets;
	const interestToBeCollected = v2Interest + v3Interest + v3ClaimableInterest;
	const canReinvest = v2Interest > 0n || (!isNonCompounding && v3Interest > 0n);
	const hasSavingsData = userSavingsBalance > 0n || totalEarnedInterest > 0n || interestToBeCollected > 0n;

	return {
		isLoaded,
		isClaiming,
		isReinvesting,
		hasSavingsData,
		canReinvest,
		isNonCompounding,
		totalEarnedInterest,
		interestToBeCollected,
		userSavingsBalance,
		v2SavingsBalance,
		v3SavingsBalance,
		v2Interest,
		v3Interest,
		v3ClaimableInterest,
		v2VaultShares,
		v2VaultAssets,
		v3VaultShares,
		v3VaultAssets,
		claimInterest,
		refetchInterest,
		handleReinvest,
	};
};
