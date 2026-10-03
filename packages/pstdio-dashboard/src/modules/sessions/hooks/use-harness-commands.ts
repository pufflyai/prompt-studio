import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DraftHarnessCommandInput, HarnessCommandState, HarnessOperation } from "pstdio-api-contracts";
import { apiRequest } from "@/lib/api";
export const useHarnessCommands = (
  sessionId: string | null,
  harnessId: string,
  draft: DraftHarnessCommandInput | undefined,
  createCommand: (
    operation: HarnessOperation,
  ) => Promise<{ status: "completed" | "started"; sessionId: string; message?: string }>,
) => {
  const client = useQueryClient();
  const queryKey = ["harness-commands", sessionId, harnessId, sessionId ? undefined : draft];
  const state = useQuery({
    queryKey,
    enabled: Boolean(harnessId && (sessionId || draft)),
    refetchInterval: 2000,
    queryFn: ({ signal }) =>
      apiRequest<HarnessCommandState & { harnessId: string }>(
        sessionId ? `/v1/sessions/${sessionId}/harness-commands` : "/v1/sessions/harness-command-state",
        sessionId ? { signal } : { method: "POST", body: draft, signal },
      ),
  });
  const invoke = useMutation<
    { status: "started" | "completed"; message?: string; sessionId?: string },
    Error,
    HarnessOperation
  >({
    mutationFn: (operation: HarnessOperation) =>
      !sessionId
        ? createCommand(operation)
        : apiRequest<{ status: "started" | "completed"; message?: string; sessionId?: string }>(
            `/v1/sessions/${sessionId}/harness-commands`,
            {
              method: "POST",
              body: { operation, harnessId },
            },
          ),
    onSettled: () => {
      void client.invalidateQueries({ queryKey });
    },
  });
  return {
    state: state.data?.harnessId === harnessId ? state.data : undefined,
    invoke,
    loading: state.isLoading,
    error: state.error,
  };
};
