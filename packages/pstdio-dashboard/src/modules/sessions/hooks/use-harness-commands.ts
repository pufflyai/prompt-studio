import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DraftHarnessCommandInput, HarnessCommandState, HarnessOperation } from "pstdio-api-contracts";
import { apiRequest } from "@/lib/api";
import { assertCurrentNativeAction } from "../chat/native-action-state";
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
    { operation: HarnessOperation; modeSnapshot?: HarnessCommandState["modes"][number] }
  >({
    mutationFn: async ({ operation, modeSnapshot }) => {
      if (operation.kind === "mode-action") {
        const fresh = await state.refetch();
        if (fresh.error || fresh.data?.harnessId !== harnessId)
          throw new Error("Native status is unavailable. Wait for it to reconnect before trying again.");
        assertCurrentNativeAction(
          modeSnapshot ? [modeSnapshot] : (state.data?.modes ?? []),
          fresh.data.modes,
          operation,
        );
      }
      return !sessionId
        ? createCommand(operation)
        : apiRequest<{ status: "started" | "completed"; message?: string; sessionId?: string }>(
            `/v1/sessions/${sessionId}/harness-commands`,
            {
              method: "POST",
              body: { operation, harnessId },
            },
          );
    },
    onSettled: async () => {
      await client.invalidateQueries({ queryKey });
    },
  });
  return {
    state: state.data?.harnessId === harnessId ? state.data : undefined,
    invoke,
    loading: state.isLoading,
    error: state.error,
  };
};
