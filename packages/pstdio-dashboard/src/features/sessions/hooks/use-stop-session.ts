import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../../lib/api";

export const stopSession = async (sessionId: string) => {
  await apiRequest(`/v1/sessions/${sessionId}/status`, {
    method: "PATCH",
    body: { status: "cancelled" },
  });
};

export const useStopSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: stopSession,
    onSuccess: (_, sessionId) => {
      void queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    },
  });
};
