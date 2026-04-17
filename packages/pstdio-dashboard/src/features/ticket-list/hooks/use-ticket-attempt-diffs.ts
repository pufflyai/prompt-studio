import { useQueries } from "@tanstack/react-query";
import { getTicketAttemptDiffSummary } from "@/features/ticket-list/data/api";
import type { TicketAttempt } from "@/features/ticket-list/types";

interface AttemptDiffInput {
  workspaceId: string;
  shouldFetch: boolean;
}

export const shouldFetchTicketAttemptDiff = (attempt: Pick<TicketAttempt, "attemptStatusId" | "sessionStatus">) => {
  return attempt.sessionStatus !== null || attempt.attemptStatusId !== null;
};

export const useTicketAttemptDiffs = (attempts: AttemptDiffInput[]) => {
  const uniqueIds = [
    ...new Set(attempts.filter((attempt) => attempt.shouldFetch).map((attempt) => attempt.workspaceId)),
  ];

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
