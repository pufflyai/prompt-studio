import { useQueries } from "@tanstack/react-query";
import { getTicketAttemptDiffSummary } from "@/features/ticket-list/data/api";

interface AttemptDiffInput {
  workspaceId: string;
  settled: boolean;
}

export const useTicketAttemptDiffs = (attempts: AttemptDiffInput[]) => {
  const settled = attempts.filter((a) => a.settled);
  const uniqueIds = [...new Set(settled.map((a) => a.workspaceId))];

  const queries = useQueries({
    queries: uniqueIds.map((workspaceId) => ({
      queryKey: ["ticket-attempt-diff-summary", workspaceId],
      queryFn: () => getTicketAttemptDiffSummary(workspaceId),
    })),
  });

  const diffTotalsByWorkspaceId = new Map<string, { additions: number; deletions: number }>();

  for (const [index, workspaceId] of uniqueIds.entries()) {
    const totals = queries[index]?.data;
    if (!totals) continue;

    diffTotalsByWorkspaceId.set(workspaceId, {
      additions: totals.additions,
      deletions: totals.deletions,
    });
  }

  return { diffTotalsByWorkspaceId };
};
