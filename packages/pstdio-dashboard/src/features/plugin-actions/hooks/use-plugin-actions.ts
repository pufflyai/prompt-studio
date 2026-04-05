import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ActionDescriptor, type ExecuteActionInput, executeAction, listActions } from "../api";

export const usePluginActions = (projectId: string | undefined, targetType?: string) =>
  useQuery({
    queryKey: ["plugin-actions", projectId, targetType],
    queryFn: () => listActions(projectId!, targetType),
    enabled: Boolean(projectId),
  });

export const useExecutePluginAction = (projectId: string | undefined) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ actionKey, input }: { actionKey: string; input: ExecuteActionInput }) => {
      if (!projectId) throw new Error("Project id is required to execute actions.");
      return executeAction(projectId, actionKey, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plugin-actions", projectId] });
    },
  });
};

export const filterActionsByPlacement = (actions: ActionDescriptor[] | undefined, placement: string) =>
  (actions ?? []).filter((a) => a.placement === placement);
