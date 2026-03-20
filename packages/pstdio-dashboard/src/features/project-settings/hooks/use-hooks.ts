import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteProjectHook, getProjectHooks, setProjectHook } from "../data/hooks-api";

export const useProjectHooks = (projectId: string | undefined) =>
  useQuery({
    queryKey: ["project-hooks", projectId],
    queryFn: () => getProjectHooks(projectId!),
    enabled: Boolean(projectId),
  });

export const useSaveProjectHook = (projectId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { hookName: string; content: string }) => {
      if (!projectId) throw new Error("Project id is required.");
      await setProjectHook(projectId, input.hookName, input.content);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-hooks", projectId] });
    },
  });
};

export const useDeleteProjectHook = (projectId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (hookName: string) => {
      if (!projectId) throw new Error("Project id is required.");
      await deleteProjectHook(projectId, hookName);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-hooks", projectId] });
    },
  });
};
