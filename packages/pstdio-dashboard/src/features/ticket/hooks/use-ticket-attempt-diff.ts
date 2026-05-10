import { useQuery } from "@tanstack/react-query";
import { ATTEMPT_DIFF_MODE, getWorkspaceDiffFiles } from "@/shared/workspace-diff-api";

export const useTicketAttemptDiff = (attemptId: string | null | undefined) =>
  useQuery({
    queryKey: ["ticket-attempt-diff-files", attemptId, ATTEMPT_DIFF_MODE],
    queryFn: () => getWorkspaceDiffFiles(attemptId!, ATTEMPT_DIFF_MODE),
    enabled: Boolean(attemptId),
  });
