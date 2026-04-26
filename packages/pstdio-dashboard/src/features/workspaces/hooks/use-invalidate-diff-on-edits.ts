import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { ATTEMPT_DIFF_MODE, getTicketAttemptDiff } from "@/features/ticket-list/data/api";

const DEBOUNCE_MS = 2000;

export const useInvalidateDiffOnEdits = (workspaceId: string | null) => {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevWorkspaceIdRef = useRef(workspaceId);

  if (prevWorkspaceIdRef.current !== workspaceId) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    prevWorkspaceIdRef.current = workspaceId;
  }

  return () => {
    if (!workspaceId) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      queryClient.fetchQuery({
        queryKey: ["ticket-attempt-diff", workspaceId, ATTEMPT_DIFF_MODE],
        queryFn: () => getTicketAttemptDiff(workspaceId, ATTEMPT_DIFF_MODE),
      });
    }, DEBOUNCE_MS);
  };
};
