import { useQueries } from "@tanstack/react-query";
import { ATTEMPT_DIFF_MODE, getTicketAttemptDiff } from "@/features/ticket-list/data/api";

export const useTicketAttemptDiffs = (workspaceIds: string[]) => {
  const uniqueWorkspaceIds = [...new Set(workspaceIds.filter((workspaceId) => workspaceId.length > 0))];

  const queries = useQueries({
    queries: uniqueWorkspaceIds.map((workspaceId) => ({
      queryKey: ["ticket-attempt-diff", workspaceId, ATTEMPT_DIFF_MODE],
      queryFn: () => getTicketAttemptDiff(workspaceId, ATTEMPT_DIFF_MODE),
    })),
  });

  const diffTotalsByWorkspaceId = new Map<string, { additions: number; deletions: number }>();

  for (const [index, workspaceId] of uniqueWorkspaceIds.entries()) {
    const totals = queries[index]?.data?.totals;
    if (!totals) continue;

    diffTotalsByWorkspaceId.set(workspaceId, {
      additions: totals.additions,
      deletions: totals.deletions,
    });
  }

  return { diffTotalsByWorkspaceId };
};
