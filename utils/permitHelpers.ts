import { Address, encodeFunctionData, maxUint256 } from "viem";
import { signTypedData } from "wagmi/actions";
import { WAGMI_CONFIG } from "../app.config";

// EIP-2612 Permit types
export const permitTypes = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

// dEURO Permit ABI
export const permitABI = [
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "value", type: "uint256" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
      { internalType: "uint8", name: "v", type: "uint8" },
      { internalType: "bytes32", name: "r", type: "bytes32" },
      { internalType: "bytes32", name: "s", type: "bytes32" },
    ],
    name: "permit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    name: "nonces",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "DOMAIN_SEPARATOR",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

interface PermitSignatureResult {
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
  deadline: bigint;
  permitCalldata: `0x${string}`;
}

export async function createPermitSignature({
  owner,
  spender,
  value,
  nonce,
  chainId,
  deuroAddress,
  deuroName = "dEURO",
}: {
  owner: Address;
  spender: Address;
  value: bigint;
  nonce: bigint;
  chainId: number;
  deuroAddress: Address;
  deuroName?: string;
}): Promise<PermitSignatureResult> {
  // Set deadline to 30 minutes from now
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 30 * 60);

  // Sign the permit
  const signature = await signTypedData(WAGMI_CONFIG, {
    domain: {
      name: deuroName,
      version: "1",
      chainId: chainId,
      verifyingContract: deuroAddress,
    },
    types: permitTypes,
    primaryType: "Permit",
    message: {
      owner,
      spender,
      value: value === maxUint256 ? maxUint256 : value,
      nonce,
      deadline,
    },
  });

  // Split signature
  const r = signature.slice(0, 66) as `0x${string}`;
  const s = `0x${signature.slice(66, 130)}` as `0x${string}`;
  const v = parseInt(signature.slice(130, 132), 16);

  // Encode permit function call
  const permitCalldata = encodeFunctionData({
    abi: permitABI,
    functionName: "permit",
    args: [owner, spender, value, deadline, v, r, s],
  });

  return {
    v,
    r,
    s,
    deadline,
    permitCalldata,
  };
}