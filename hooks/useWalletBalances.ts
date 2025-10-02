import { useMemo } from "react";
import { Abi, Address, erc20Abi } from "viem";
import { useAccount, useReadContracts, useBalance } from "wagmi";
import { WAGMI_CHAIN } from "../app.config";


type QueryItem = {
	chainId: number;
	address: `0x${string}`;
	abi: Abi;
	functionName: string;
	args?: any[];
};

export type TokenDescriptor = {
	symbol: string;
	name: string;
	address: `0x${string}`;
	allowance?: `0x${string}`[];
};

export type TokenBalance = {
	symbol: string;
	name: string;
	address: `0x${string}`;
	decimals: number;
	balanceOf: bigint;
	allowance?: Record<string, bigint>;
};

type Options = {
	accountAddress?: `0x${string}`;
};

const getMappedResponseByAddress = (query: QueryItem[], tokenList: TokenDescriptor[], response: any[]) => {
	const mappedResponse: Record<string, TokenBalance> = {};

	tokenList.forEach((token) => {
		mappedResponse[token.address] = { address: token.address, symbol: token.symbol, name: token.name, decimals: 0, balanceOf: BigInt(0), allowance: {} };
		if (!response?.length) return;

		const tokenQuery = query.filter((queryItem) => queryItem.address === token.address);
		const startIndex = query.findIndex(q => q.address === token.address);
		
		tokenQuery.forEach((queryItem, i) => {
			const { functionName, args } = queryItem;
			const valueResponse = response[startIndex + i]?.result;
			if (!valueResponse) return;
			
			if (functionName === "allowance") {
				const contractAddress = args?.[1];
				if (contractAddress) {
					// @ts-ignore
					mappedResponse[token.address].allowance[contractAddress] = valueResponse;
					return;
				}
			}

			// @ts-ignore
			mappedResponse[token.address][functionName as keyof TokenBalance] = valueResponse;
		});
	});

	return mappedResponse;
}; 

export function useWalletERC20Balances(tokenList: TokenDescriptor[] = [], { accountAddress }: Options = {}) {
	const { address } = useAccount();
	const account = accountAddress || address;

	// Get native ETH balance
	const { data: ethBalanceData } = useBalance({
		address: account,
	});

	const chainId = WAGMI_CHAIN.id as number;

	// Filter out ETH from the token list for ERC20 queries
	const erc20TokenList = tokenList.filter((token) => token.symbol !== 'ETH');
	const ethToken = tokenList.find((token) => token.symbol === 'ETH');

	const query = useMemo(
		() =>
			erc20TokenList
				.map((token) => [
					{
						chainId: chainId,
						address: token.address,
						abi: erc20Abi,
						functionName: "name",
					},
					{
						chainId: chainId,
						address: token.address,
						abi: erc20Abi,
						functionName: "balanceOf",
						args: [account as Address],
					},
					{
						chainId,
						address: token.address,
						abi: erc20Abi,
						functionName: "symbol",
					},
					{
						chainId,
						address: token.address,
						abi: erc20Abi,
						functionName: "decimals",
					},
					...(token.allowance?.map((contractAddress) => ({
						chainId,
						address: token.address,
						abi: erc20Abi,
						functionName: "allowance",
						args: [account as Address, contractAddress],
					})) || []),
				])
				.flat(),
		[erc20TokenList, address, chainId]
	);

	const { data, isLoading, refetch } = useReadContracts({
		contracts: query,
	}) ?? { data: [], isLoading: true };

	const responseMappedByAddress = useMemo(() => {
		const erc20Balances = getMappedResponseByAddress(query, erc20TokenList, data as any[]);

		// Add ETH balance if ETH token is in the list (ETH uses zero address as identifier)
		if (ethToken) {
			erc20Balances[ethToken.address] = {
				address: ethToken.address,
				symbol: 'ETH',
				name: 'Ethereum',
				decimals: 18,
				balanceOf: ethBalanceData?.value ?? 0n,
				allowance: {},
			};
		}

		return erc20Balances;
	}, [query, data, isLoading, ethToken, ethBalanceData]);

	return { balances: Object.values(responseMappedByAddress), balancesByAddress: responseMappedByAddress, isLoading, refetchBalances: refetch };
}
