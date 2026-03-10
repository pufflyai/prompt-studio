import { apiRequest } from "@/lib/api";
import { useMutation } from "@/lib/use-mutation";

export const useArchiveSession = () =>
  useMutation(async (sessionId: string) => {
    await apiRequest(`/v1/sessions/${sessionId}/archive`, { method: "POST" });
  });
