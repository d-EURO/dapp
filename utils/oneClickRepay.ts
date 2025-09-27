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

// Error types for better error handling
export class PermitSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermitSignatureError';
  }
}

export class MulticallExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MulticallExecutionError';
  }
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

  let repayCalldata: `0x${string}`;
  let actualRepayAmount: bigint;

  // Check if this is a full repayment and determine actual amount needed
  if (repayAmount >= totalDebt) {
    // For full repayment, we need to approve the exact debt amount
    actualRepayAmount = totalDebt;
    // Full repayment - use adjust to close position
    repayCalldata = encodeFunctionData({
      abi: PositionV2ABI,
      functionName: "adjust",
      args: [0n, 0n, positionPrice],
    });
  } else {
    // Partial repayment - calculate optimal amount
    actualRepayAmount = calculateOptimalRepayAmount({
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
      args: [actualRepayAmount],
    });
  }

  let permitCalldata: `0x${string}`;

  try {
    // Create permit signature with the actual amount that will be used
    const result = await createPermitSignature({
      owner: userAddress,
      spender: positionAddress,
      value: actualRepayAmount,
      nonce: nonce as bigint,
      chainId,
      deuroAddress,
      deuroName: deuroSymbol,
    });
    permitCalldata = result.permitCalldata;
  } catch (error: any) {
    // If user rejects signature, throw specific error
    if (error?.code === 'ACTION_REJECTED' || error?.message?.includes('rejected')) {
      throw new PermitSignatureError('User rejected permit signature');
    }
    throw error;
  }

  // Execute multicall: permit + repay in one transaction
  try {
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
  } catch (error: any) {
    // If multicall fails, it might be due to simulation
    // In production, we should analyze the error and potentially retry
    console.error('Multicall execution failed:', error);
    throw new MulticallExecutionError(`Multicall failed: ${error?.message || 'Unknown error'}`);
  }
}