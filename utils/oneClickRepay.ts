import { Address, encodeFunctionData } from "viem";
import { writeContract, readContract } from "wagmi/actions";
import { WAGMI_CONFIG } from "../app.config";
import { PositionV2ABI } from "@deuro/eurocoin";
import { MULTICALL3_ADDRESS, multicall3ABI } from "./multicall3";
import { createPermitSignature, permitABI } from "./permitHelpers";
import { calculateOptimalRepayAmount } from "./dynamicRepayCalculations";

interface OneClickRepayParams {
  userAddress: Address;
  positionAddress: Address;
  deuroAddress: Address;
  deuroSymbol: string;
  repayAmount: bigint;
  totalDebt: bigint;
  walletBalance: bigint;
  principal: bigint;
  interest: bigint;
  reserveContribution: bigint;
  fixedAnnualRatePPM: number;
  chainId: number;
  positionPrice: bigint;
}

export async function executeOneClickRepay({
  userAddress,
  positionAddress,
  deuroAddress,
  deuroSymbol,
  repayAmount,
  totalDebt,
  walletBalance,
  principal,
  interest,
  reserveContribution,
  fixedAnnualRatePPM,
  chainId,
  positionPrice,
}: OneClickRepayParams): Promise<`0x${string}`> {
  // Get current nonce for permit
  const nonce = await readContract(WAGMI_CONFIG, {
    address: deuroAddress,
    abi: permitABI,
    functionName: "nonces",
    args: [userAddress],
  });

  // Create permit signature
  const { permitCalldata } = await createPermitSignature({
    owner: userAddress,
    spender: positionAddress,
    value: repayAmount,
    nonce: nonce as bigint,
    chainId,
    deuroAddress,
    deuroName: deuroSymbol,
  });

  let repayCalldata: `0x${string}`;

  // Check if this is a full repayment
  if (repayAmount >= totalDebt) {
    // Full repayment - use adjust to close position
    repayCalldata = encodeFunctionData({
      abi: PositionV2ABI,
      functionName: "adjust",
      args: [0n, 0n, positionPrice],
    });
  } else {
    // Partial repayment - calculate optimal amount
    const optimalRepayAmount = calculateOptimalRepayAmount({
      userInputAmount: repayAmount,
      currentInterest: interest,
      walletBalance,
      reserveContribution,
      principal,
      fixedAnnualRatePPM,
    });

    repayCalldata = encodeFunctionData({
      abi: PositionV2ABI,
      functionName: "repay",
      args: [optimalRepayAmount],
    });
  }

  // Execute multicall: permit + repay in one transaction
  const txHash = await writeContract(WAGMI_CONFIG, {
    address: MULTICALL3_ADDRESS,
    abi: multicall3ABI,
    functionName: "aggregate",
    args: [
      [
        {
          target: deuroAddress,
          callData: permitCalldata,
        },
        {
          target: positionAddress,
          callData: repayCalldata,
        },
      ],
    ],
  });

  return txHash;
}