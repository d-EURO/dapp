import { Abi, Address } from "viem";

interface ContractDetails {
	chainId: number;
	address: Address;
	abi: Abi;
	functionName: string;
    groupKey?: string;
}

interface ContractMultipleCall extends ContractDetails {
	calls?: { id: string; args?: any[] }[];
}

interface ContractSingleCall extends ContractDetails {
	args?: any[];
}

type ContractCallParams = ContractMultipleCall | ContractSingleCall;

interface ContractCallQuery extends ContractDetails {
	args?: any[];
}

interface IndexedCall extends ContractDetails {
	id?: string;
    groupKey?: string;
	args?: any[];
    multiple?: boolean;
}

export const buildContractBatcher = (callDescriptors: ContractCallParams[]): { getQuery: () => ContractCallQuery[], parseResponse: (response: any[]) => Record<string, any> } => {
	const indexedCalls: IndexedCall[] = [];

	callDescriptors.forEach((callDescriptor) => {
		if ('calls' in callDescriptor && callDescriptor.calls) {
			callDescriptor.calls.forEach((call) => {
				indexedCalls.push({
					...callDescriptor,
					args: call.args,
					multiple: true,
					id: call.id,
				});
			});
		} else {
			indexedCalls.push({
				...callDescriptor,
				id: callDescriptor.functionName,
			});
		}
	});

    const getQuery = (): ContractCallQuery[] => indexedCalls.map((call) => ({
        chainId: call.chainId,
        address: call.address,
        abi: call.abi,
        functionName: call.functionName,
        args: call.args,
    }));

    const parseResponse = (response: any[]): Record<string, any> => response.reduce((acc, item, index) => {
        const { id, address, groupKey, multiple, functionName } = indexedCalls[index];
        const groupKeyString = groupKey || address;
        return {
            ...acc,
            [groupKeyString]: {
                ...acc[groupKeyString],
                [functionName]: multiple ? { ...(acc[groupKeyString]?.[functionName] || {}), [id!]: item } : item,
            },
        };
    }, {});

    return { getQuery, parseResponse };
};
