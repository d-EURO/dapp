import { gql, useQuery } from "@apollo/client";

export const useTotalSavingsUsers = () => {
	// Query the SavingsStats entity which contains aggregated user count
	const { data, loading, error } = useQuery(
		gql`
			{
				savingsStats(id: "global") {
					totalUsers
					lastUpdated
				}
			}
		`,
		{
			pollInterval: 60000, // Poll every 60 seconds
			fetchPolicy: "cache-and-network",
		}
	);

	const totalUsers = data?.savingsStats?.totalUsers || 0;

	return {
		totalUsers,
		loading,
		error,
	};
};
