import { toaster } from "@pstdio/ui";
import { useState } from "react";
import type { ActionDescriptor, ActionParamValue, ActionResult } from "../api";
import { useExecutePluginAction, usePluginActions } from "./use-plugin-actions";

interface UsePluginActionTriggerInput {
  projectId: string | undefined;
  targetType: ActionDescriptor["targetType"];
  onSuccess?: (result: Extract<ActionResult, { status: "success" }>) => void | Promise<void>;
}

type ActiveParamRequest = {
  action: ActionDescriptor;
  targetId: string;
};

export const usePluginActionTrigger = (input: UsePluginActionTriggerInput) => {
  const { projectId, targetType, onSuccess } = input;
  const { data: pluginActions } = usePluginActions(projectId, targetType);
  const executePluginAction = useExecutePluginAction(projectId);
  const [activeParamRequest, setActiveParamRequest] = useState<ActiveParamRequest | null>(null);
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);

  const runAction = async (
    action: ActionDescriptor,
    targetId: string,
    params: Record<string, ActionParamValue> | undefined = undefined,
  ) => {
    setPendingActionKey(action.key);

    try {
      const result = await executePluginAction.mutateAsync({
        actionKey: action.key,
        input: { target_type: targetType, target_id: targetId, ...(params ? { params } : {}) },
      });

      if (result.status === "error") {
        toaster.create({ type: "error", title: action.label, description: result.message });
        return false;
      }

      await onSuccess?.(result);
      return true;
    } finally {
      setPendingActionKey(null);
    }
  };

  const trigger = async (actionKey: string, targetId: string) => {
    const action = pluginActions?.find((item) => item.key === actionKey);
    if (!action) return;

    if (action.params?.length) {
      setActiveParamRequest({ action, targetId });
      return;
    }

    await runAction(action, targetId);
  };

  const submitWithParams = async (params: Record<string, ActionParamValue>) => {
    if (!activeParamRequest) return;

    const request = activeParamRequest;
    const didSucceed = await runAction(request.action, request.targetId, params);
    if (didSucceed) {
      setActiveParamRequest(null);
    }

    return didSucceed;
  };

  const cancelParams = () => setActiveParamRequest(null);

  return {
    pluginActions,
    activeParamAction: activeParamRequest?.action ?? null,
    trigger,
    submitWithParams,
    cancelParams,
    pendingActionKey,
    isExecuting: executePluginAction.isPending,
  };
};
