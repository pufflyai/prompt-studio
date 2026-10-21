import { useWorkbenchStore, type WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DraftHarnessCommandInput, HarnessCommandState, HarnessOperation } from "pstdio-api-contracts";
import { getApiClient } from "@/lib/api";
import { assertCurrentNativeAction } from "../chat/native-action-state";

export const useHarnessCommands = (
  sessionId: string | null,
  harnessId: string,
  draft: DraftHarnessCommandInput | undefined,
  createCommand: (
    operation: HarnessOperation,
  ) => Promise<{ status: "completed" | "started"; sessionId: string; message?: string }>,
  input: WorkbenchPanelRenderInput,
) => {
  const open = useWorkbenchStore(input.workbench.layout.store, () =>
    input.workbench.host.getOpenPlacements().some((placement) => placement.widgetId === input.instance.instanceId),
  );
  const client = useQueryClient();
  const queryKey = ["harness-commands", sessionId, harnessId, sessionId ? undefined : draft];
  const state = useQuery<HarnessCommandState & { harnessId: string }>({
    queryKey,
    enabled: open && Boolean(harnessId && (sessionId || draft)),
    // Failed draft discovery recovers when its workspace becomes ready. Healthy
    // drafts refresh with inputs, focus, and native actions; conversations keep
    // polling so modes created by the agent become visible.
    refetchInterval: (query) => (sessionId || query.state.status === "error" ? 2000 : false),
    queryFn: ({ signal }) =>
      sessionId
        ? getApiClient().sessions.getHarnessCommands(sessionId, signal)
        : getApiClient().sessions.getDraftHarnessCommands(draft!, signal),
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
        : getApiClient().sessions.invokeHarnessOperation(sessionId, operation, harnessId);
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
