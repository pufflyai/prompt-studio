import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ActionDescriptor, type ExecuteActionInput, executeAction, listActions } from "../api";

export const usePluginActions = (projectId: string | undefined, targetType?: string) =>
  useQuery({
    queryKey: ["plugin-actions", projectId, targetType],
    queryFn: () => listActions(projectId!, targetType),
    enabled: Boolean(projectId),
  });

export const useExecutePluginAction = (projectId: string | undefined) => {
  const queryClient = useQueryClient();

  return async ({ actionKey, input }: { actionKey: string; input: ExecuteActionInput }) => {
    if (!projectId) throw new Error("Project id is required to execute actions.");

    const result = await executeAction(projectId, actionKey, input);

    await queryClient.invalidateQueries({ queryKey: ["plugin-actions", projectId] });

    return result;
  };
};

export const filterActionsByPlacement = (actions: ActionDescriptor[] | undefined, placement: string) =>
  (actions ?? []).filter((a) => a.placement === placement);
