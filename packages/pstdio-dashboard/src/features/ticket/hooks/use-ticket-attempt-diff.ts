import { useQuery } from "@tanstack/react-query";
import { getTicketAttemptDiff } from "@/features/ticket-list/data/api";

const ticketAttemptDiffKeys = {
  byAttempt: (attemptId: string) => ["ticketAttemptDiff", attemptId] as const,
};

export const useTicketAttemptDiff = (attemptId: string | null | undefined) => {
  return useQuery({
    queryKey: ticketAttemptDiffKeys.byAttempt(attemptId ?? ""),
    queryFn: () => getTicketAttemptDiff(attemptId ?? ""),
    enabled: Boolean(attemptId),
    staleTime: 30_000,
  });
};
