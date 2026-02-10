import { useChainId, useReadContracts } from "wagmi";
import { NativePSHolder } from "./useNativePSHolders";
import { decodeBigIntCall } from "../utils/format";
import { ADDRESS, EquityABI } from "@juicedollar/jusd";

type VotesData = {
	holder: `0x${string}`;
	nativePS: bigint;
	votingPower: any;
};

export const useVotingPowers = (holders: NativePSHolder[]) => {
	const chainId = useChainId();
	const contractCalls: any[] = [];
	if (chainId) {
		holders.forEach((holder) => {
			contractCalls.push({
				chainId,
				address: ADDRESS[chainId].equity,
				abi: EquityABI,
				functionName: "votes",
				args: [holder.address],
			});
		});
		contractCalls.push({
			chainId,
			address: ADDRESS[chainId].equity,
			abi: EquityABI,
			functionName: "totalVotes",
		});
	}

	const { data } = useReadContracts({
		contracts: contractCalls,
	});

	const votesData: VotesData[] = [];
	if (data) {
		holders.forEach((holder, i) => {
			votesData.push({
				holder: holder.address,
				nativePS: holder.votingPower,
				votingPower: data[i].result,
			});
		});
	}

	const totalVotes = data ? decodeBigIntCall(data[holders.length]) : 0n;

	votesData.sort((a, b) => (a.votingPower > b.votingPower ? -1 : 1));

	return { votesData, totalVotes };
};
