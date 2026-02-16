import React from "react";
import { Tooltip } from "flowbite-react";
import { useGovStats } from "@hooks";
import Button from "@components/Button";

interface Props {
	children?: React.ReactNode;
	label?: string;
	disabled?: boolean;
	buttonClassName?: string;
}

const MIN_VOTING_POWER_BPS = 200n; // 2% in basis points

export default function GuardToMinVotingPower(props: Props) {
	const { totalVotes, userVotes } = useGovStats();

	const hasEnoughVotingPower = totalVotes > 0n && (userVotes * 10000n) / totalVotes >= MIN_VOTING_POWER_BPS;

	if (!hasEnoughVotingPower) {
		return (
			<Tooltip content="You need at least 2% voting power to perform this action." style="light">
				<Button className={`h-10 ${props.buttonClassName ?? ""}`} disabled>
					{props.label ?? "Action"}
				</Button>
			</Tooltip>
		);
	}

	return <>{props.children}</>;
}
