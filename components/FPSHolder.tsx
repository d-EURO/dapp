import { formatBigInt, shortenAddress } from "../utils/format";
import { Address } from "viem";
import AppBox from "./AppBox";
import AddressLabel from "./AddressLabel";

interface Props {
	id: string;
	holder: Address;
	fps: bigint;
	votingPower: bigint;
	totalVotingPower: bigint;
}

export default function FPSHolder({ id, holder, fps, votingPower, totalVotingPower }: Props) {
	return (
		<AppBox className="hover:bg-slate-700 duration-300 flex grid grid-cols-1 sm:grid-cols-3">
			<div className="col-span-1">
				<AddressLabel address={holder} showCopy showLink />
			</div>
			<div className="col-span-1 sm:text-center">{formatBigInt(fps)} FPS</div>
			<div className="col-span-1 sm:text-right">{formatBigInt((votingPower * 10000n) / totalVotingPower, 2)} % Votes</div>
		</AppBox>
	);
}
