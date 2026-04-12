import { useMutation } from "@tanstack/react-query";
import { archiveWorkspace, deleteWorkspace } from "../data/api/workspaces";

export const useArchiveWorkspace = (projectId: string | undefined) =>
  useMutation({
    mutationFn: async ({ workspaceId }: { workspaceId: string }) => {
      if (!projectId) throw new Error("Project id is required to archive workspaces.");
      await archiveWorkspace(workspaceId);
    },
  });

export const useDeleteWorkspace = (projectId: string | undefined) =>
  useMutation({
    mutationFn: async ({ workspaceId }: { workspaceId: string }) => {
      if (!projectId) throw new Error("Project id is required to delete workspaces.");
      await deleteWorkspace(workspaceId);
    },
  });
