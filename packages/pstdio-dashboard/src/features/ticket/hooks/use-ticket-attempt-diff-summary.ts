import { useQuery } from "@tanstack/react-query";
import { getTicketAttemptDiffSummary } from "@/features/ticket-list/data/api";
import { ATTEMPT_DIFF_MODE } from "@/shared/workspace-diff-api";

export const useTicketAttemptDiffSummary = (workspaceId: string | null | undefined) =>
  useQuery({
    queryKey: ["ticket-attempt-diff-summary", workspaceId, ATTEMPT_DIFF_MODE],
    queryFn: () => getTicketAttemptDiffSummary(workspaceId!, ATTEMPT_DIFF_MODE),
    enabled: Boolean(workspaceId),
  });
