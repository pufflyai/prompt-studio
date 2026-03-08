import { useMutation, useQueryClient } from "@tanstack/react-query";
import { projectKeys } from "@/features/project/hooks/keys";
import { apiRequest } from "@/lib/api";

export const useArchiveSession = (projectId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      await apiRequest(`/v1/sessions/${sessionId}/archive`, { method: "POST" });
    },
    onSuccess: () => {
      if (!projectId) return;
      queryClient.invalidateQueries({ queryKey: projectKeys.sessions(projectId) });
    },
  });
};
