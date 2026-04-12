import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

const pendingStopRequests = new Map<string, Promise<void>>();

export const useStopSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const pending = pendingStopRequests.get(sessionId);
      if (pending) {
        return pending;
      }

      const request = apiRequest<void>(`/v1/sessions/${sessionId}/status`, {
        method: "PATCH",
        body: { status: "cancelled" },
      }).finally(() => {
        pendingStopRequests.delete(sessionId);
      });

      pendingStopRequests.set(sessionId, request);
      await request;
    },
    onSuccess: async (_, sessionId) => {
      await queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    },
  });
};
