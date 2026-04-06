import { useState } from "react";
import type { ActionDescriptor, ActionParamValue } from "../api";
import { useExecutePluginAction, usePluginActions } from "./use-plugin-actions";

export const usePluginActionTrigger = (projectId: string | undefined) => {
  const { data: pluginActions } = usePluginActions(projectId, "ticket");
  const executePluginAction = useExecutePluginAction(projectId);
  const [activeParamAction, setActiveParamAction] = useState<ActionDescriptor | null>(null);

  const trigger = (actionKey: string, targetType: string, targetId: string) => {
    const action = pluginActions?.find((a) => a.key === actionKey);
    if (action?.params?.length) {
      setActiveParamAction(action);
    } else {
      executePluginAction.mutate({ actionKey, input: { target_type: targetType, target_id: targetId } });
    }
  };

  const submitWithParams = (targetType: string, targetId: string, params: Record<string, ActionParamValue>) => {
    if (!activeParamAction) return;
    executePluginAction.mutate({
      actionKey: activeParamAction.key,
      input: { target_type: targetType, target_id: targetId, params },
    });
    setActiveParamAction(null);
  };

  const cancelParams = () => setActiveParamAction(null);

  return {
    pluginActions,
    activeParamAction,
    trigger,
    submitWithParams,
    cancelParams,
  };
};
