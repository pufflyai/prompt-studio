import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export const useArchiveSession = () =>
  useMutation({
    mutationFn: async (sessionId: string) => {
      await apiRequest(`/v1/sessions/${sessionId}/archive`, { method: "POST" });
    },
  });
