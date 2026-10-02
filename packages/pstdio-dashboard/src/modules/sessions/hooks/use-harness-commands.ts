import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { HarnessCommandState, HarnessOperation } from "pstdio-api-contracts";
import { apiRequest } from "@/lib/api";
export const useHarnessCommands = (sessionId: string | null, harnessId: string) => {
  const client = useQueryClient();
  const queryKey = ["harness-commands", sessionId, harnessId];
  const state = useQuery({
    queryKey,
    enabled: Boolean(sessionId && harnessId),
    refetchInterval: 2000,
    queryFn: ({ signal }) =>
      apiRequest<HarnessCommandState & { harnessId: string }>(`/v1/sessions/${sessionId}/harness-commands`, { signal }),
  });
  const invoke = useMutation({
    mutationFn: (operation: HarnessOperation) =>
      apiRequest<{ status: "started" | "completed"; message?: string }>(`/v1/sessions/${sessionId}/harness-commands`, {
        method: "POST",
        body: { operation, harnessId },
      }),
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
