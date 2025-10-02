import { Address, parseEther, keccak256, toHex } from "viem";
import { writeContract, waitForTransactionReceipt } from "wagmi/actions";
import { WAGMI_CONFIG } from "../app.config";

// CoinLendingGateway ABI - only the functions we need
export const COIN_LENDING_GATEWAY_ABI = [
  {
    inputs: [
      { name: "parent", type: "address" },
      { name: "initialMint", type: "uint256" },
      { name: "expiration", type: "uint40" },
      { name: "frontendCode", type: "bytes32" },
      { name: "liquidationPrice", type: "uint256" }
    ],
    name: "lendWithCoin",
    outputs: [{ name: "position", type: "address" }],
    stateMutability: "payable",
    type: "function"
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "parent", type: "address" },
      { name: "initialMint", type: "uint256" },
      { name: "expiration", type: "uint40" },
      { name: "frontendCode", type: "bytes32" },
      { name: "liquidationPrice", type: "uint256" }
    ],
    name: "lendWithCoinFor",
    outputs: [{ name: "position", type: "address" }],
    stateMutability: "payable",
    type: "function"
  }
] as const;

// Contract addresses per chain
export const COIN_LENDING_GATEWAY_ADDRESSES: Record<number, Address> = {
  1: "0x1da37d613fb590eed37520b72e9c6f0f6eee89d2", // Mainnet CoinLendingGateway
  137: "0x0000000000000000000000000000000000000000", // TODO: Deploy and add Polygon address
  42161: "0x0000000000000000000000000000000000000000", // TODO: Deploy and add Arbitrum address
  8453: "0x0000000000000000000000000000000000000000", // TODO: Deploy and add Base address
  31337: "0x0000000000000000000000000000000000000000", // Local hardhat - will be set after deployment
};

export interface LendWithCoinParams {
  parentPosition: Address;
  collateralAmount: string; // ETH amount as string
  mintAmount: bigint; // dEURO to mint
  expiration: number; // Unix timestamp
  frontendCode: string; // bytes32 frontend code
  liquidationPrice: bigint; // Custom liquidation price (0 to use default)
  chainId: number;
}

/**
 * Execute a 1-click ETH lending operation using the CoinLendingGateway
 * This function handles ETH wrapping, approval, position creation, and price adjustment in a single transaction
 */
export async function lendWithCoin({
  parentPosition,
  collateralAmount,
  mintAmount,
  expiration,
  frontendCode,
  liquidationPrice,
  chainId
}: LendWithCoinParams): Promise<{
  hash: `0x${string}`;
  positionAddress?: Address;
}> {
  const gatewayAddress = COIN_LENDING_GATEWAY_ADDRESSES[chainId];

  if (!gatewayAddress || gatewayAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error(`CoinLendingGateway not deployed on chain ${chainId}`);
  }

  // Convert ETH amount to wei
  const value = parseEther(collateralAmount);

  // Execute the lending transaction
  const hash = await writeContract(WAGMI_CONFIG, {
    address: gatewayAddress,
    abi: COIN_LENDING_GATEWAY_ABI,
    functionName: "lendWithCoin",
    args: [
      parentPosition,
      mintAmount,
      expiration as any, // Cast to uint40
      frontendCode as `0x${string}`,
      liquidationPrice
    ],
    value
  });

  // Wait for transaction confirmation
  const receipt = await waitForTransactionReceipt(WAGMI_CONFIG, {
    hash,
    confirmations: 1
  });

  // Extract the new position address from events
  // The PositionCreatedWithCoin event contains the position address
  // event PositionCreatedWithCoin(address indexed owner, address indexed position, uint256 coinAmount, uint256 mintAmount, uint256 liquidationPrice)
  const eventSignature = keccak256(toHex("PositionCreatedWithCoin(address,address,uint256,uint256,uint256)"));
  const positionCreatedEvent = receipt.logs.find(log => {
    return log.topics[0] === eventSignature;
  });

  let positionAddress: Address | undefined;
  if (positionCreatedEvent && positionCreatedEvent.topics[2]) {
    // The position address is the second indexed parameter
    positionAddress = `0x${positionCreatedEvent.topics[2].slice(26)}` as Address;
  }

  return {
    hash,
    positionAddress
  };
}

/**
 * Check if CoinLendingGateway is available on the current chain
 */
export function isCoinLendingGatewayAvailable(chainId: number): boolean {
  const address = COIN_LENDING_GATEWAY_ADDRESSES[chainId];
  return address && address !== "0x0000000000000000000000000000000000000000";
}