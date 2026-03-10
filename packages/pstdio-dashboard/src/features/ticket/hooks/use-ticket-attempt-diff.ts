import { useQuery } from "@tanstack/react-query";
import { getTicketAttemptDiff } from "@/features/ticket-list/data/api";

export const useTicketAttemptDiff = (attemptId: string | null | undefined) =>
  useQuery({
    queryKey: ["ticket-attempt-diff", attemptId],
    queryFn: () => getTicketAttemptDiff(attemptId!),
    enabled: Boolean(attemptId),
  });
