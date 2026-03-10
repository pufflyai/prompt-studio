import { getTicketAttemptDiff } from "@/features/ticket-list/data/api";
import { useFetch } from "@/lib/use-fetch";

export const useTicketAttemptDiff = (attemptId: string | null | undefined) =>
  useFetch(() => getTicketAttemptDiff(attemptId!), [attemptId], {
    enabled: Boolean(attemptId),
  });
