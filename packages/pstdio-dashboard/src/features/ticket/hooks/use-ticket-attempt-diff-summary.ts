import { useQuery } from "@tanstack/react-query";
import { getTicketAttemptDiffSummary } from "@/features/ticket-list/data/api";

export const useTicketAttemptDiffSummary = (workspaceId: string | null | undefined) =>
  useQuery({
    queryKey: ["ticket-attempt-diff-summary", workspaceId],
    queryFn: () => getTicketAttemptDiffSummary(workspaceId!),
    enabled: Boolean(workspaceId),
  });
