import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { getTicketAttemptDiffSummary } from "@/features/ticket-list/data/api";
import { ATTEMPT_DIFF_MODE, getWorkspaceDiffFiles } from "@/shared/workspace-diff-api";

const DEBOUNCE_MS = 2000;

export const buildDiffInvalidationQueryKeys = (workspaceId: string) => ({
  files: ["ticket-attempt-diff-files", workspaceId, ATTEMPT_DIFF_MODE] as const,
  summary: ["ticket-attempt-diff-summary", workspaceId, ATTEMPT_DIFF_MODE] as const,
});

export const buildDiffInvalidationRequests = (workspaceId: string) => ({
  files: {
    queryKey: buildDiffInvalidationQueryKeys(workspaceId).files,
    mode: ATTEMPT_DIFF_MODE as typeof ATTEMPT_DIFF_MODE,
  },
  summary: {
    queryKey: buildDiffInvalidationQueryKeys(workspaceId).summary,
    mode: ATTEMPT_DIFF_MODE as typeof ATTEMPT_DIFF_MODE,
  },
});

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
      const requests = buildDiffInvalidationRequests(workspaceId);

      void Promise.all([
        queryClient.fetchQuery({
          queryKey: requests.files.queryKey,
          queryFn: () => getWorkspaceDiffFiles(workspaceId, requests.files.mode),
        }),
        queryClient.fetchQuery({
          queryKey: requests.summary.queryKey,
          queryFn: () => getTicketAttemptDiffSummary(workspaceId, requests.summary.mode),
        }),
      ]).catch(() => undefined);
    }, DEBOUNCE_MS);
  };
};
