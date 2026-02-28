import { simulateContract, writeContract } from "@wagmi/core";
import { WAGMI_CONFIG } from "../app.config";
import { Abi, Address } from "viem";
import { mainnet, testnet } from "@config";

interface SimulateAndWriteParams {
	chainId: typeof mainnet.id | typeof testnet.id;
	address: Address;
	abi: Abi;
	functionName: string;
	args?: readonly unknown[];
	value?: bigint;
	account?: Address;
	gas?: bigint;
}

export async function simulateAndWrite({
	chainId,
	address,
	abi,
	functionName,
	args,
	value,
	account,
	gas,
}: SimulateAndWriteParams): Promise<`0x${string}`> {
	const { request } = await simulateContract(WAGMI_CONFIG, {
		chainId,
		address,
		abi,
		functionName,
		args,
		...(value !== undefined ? { value } : {}),
		...(account ? { account } : {}),
	} as any);

	return writeContract(WAGMI_CONFIG, {
		...request,
		...(gas ? { gas } : {}),
	} as any);
}
