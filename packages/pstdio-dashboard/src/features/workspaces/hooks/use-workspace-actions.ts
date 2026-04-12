import { useMutation } from "@tanstack/react-query";
import { deleteWorkspace } from "../data/workspace-actions";

export const useDeleteWorkspace = () =>
  useMutation({
    mutationFn: async ({ workspaceId }: { workspaceId: string }) => {
      await deleteWorkspace(workspaceId);
    },
  });
