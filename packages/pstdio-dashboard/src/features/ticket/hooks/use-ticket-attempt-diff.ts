import { useQuery } from "@tanstack/react-query";
import { ATTEMPT_DIFF_MODE, getTicketAttemptDiff } from "@/features/ticket-list/data/api";

export const useTicketAttemptDiff = (attemptId: string | null | undefined) =>
  useQuery({
    queryKey: ["ticket-attempt-diff", attemptId, ATTEMPT_DIFF_MODE],
    queryFn: () => getTicketAttemptDiff(attemptId!, ATTEMPT_DIFF_MODE),
    enabled: Boolean(attemptId),
  });
