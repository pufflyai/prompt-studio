import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export const useStopSession = () =>
  useMutation({
    mutationFn: (sessionId: string) =>
      apiRequest(`/v1/sessions/${sessionId}/status`, {
        method: "PATCH",
        body: { status: "cancelled" },
      }),
  });
