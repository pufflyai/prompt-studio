import { useMutation } from "@tanstack/react-query";
import { archiveWorkspace, deleteWorkspace } from "../data/workspace-actions";

export const useArchiveWorkspace = () =>
  useMutation({
    mutationFn: async ({ workspaceId }: { workspaceId: string }) => {
      await archiveWorkspace(workspaceId);
    },
  });

export const useDeleteWorkspace = () =>
  useMutation({
    mutationFn: async ({ workspaceId }: { workspaceId: string }) => {
      await deleteWorkspace(workspaceId);
    },
  });
