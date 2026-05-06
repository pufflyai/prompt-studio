import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { executeExtensionCommand, getProjectExtensionMetadata } from "../api";

export const useProjectExtensionMetadata = (projectId: string | undefined) =>
  useQuery({
    queryKey: ["project-extension-metadata", projectId],
    queryFn: () => getProjectExtensionMetadata(projectId!),
    enabled: Boolean(projectId),
  });

export const useExecuteExtensionCommand = (projectId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commandId, body }: { commandId: string; body: unknown }) => {
      if (!projectId) throw new Error("Project id is required to execute extension commands.");
      return executeExtensionCommand(projectId, commandId, body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["project-extension-metadata", projectId] });
    },
  });
};
