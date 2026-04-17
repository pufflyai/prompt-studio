import { toaster } from "@pstdio/ui";
import { useRef, useState } from "react";
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

export const addPendingActionKey = (pendingActionKeys: string[], actionKey: string) =>
  pendingActionKeys.includes(actionKey) ? pendingActionKeys : [...pendingActionKeys, actionKey];

export const removePendingActionKey = (pendingActionKeys: string[], actionKey: string) =>
  pendingActionKeys.filter((key) => key !== actionKey);

export const usePluginActionTrigger = (input: UsePluginActionTriggerInput) => {
  const { projectId, targetType, onSuccess } = input;
  const pluginActionsQuery = usePluginActions(projectId, targetType);
  const pluginActions = pluginActionsQuery.data;
  const executePluginAction = useExecutePluginAction(projectId);
  const [activeParamRequest, setActiveParamRequest] = useState<ActiveParamRequest | null>(null);
  const [pendingActionKeys, setPendingActionKeys] = useState<string[]>([]);
  const pendingActionKeysRef = useRef<string[]>([]);

  const replacePendingActionKeys = (nextPendingActionKeys: string[]) => {
    pendingActionKeysRef.current = nextPendingActionKeys;
    setPendingActionKeys(nextPendingActionKeys);
  };

  const markActionPending = (actionKey: string) => {
    const nextPendingActionKeys = addPendingActionKey(pendingActionKeysRef.current, actionKey);
    if (nextPendingActionKeys === pendingActionKeysRef.current) {
      return false;
    }

    replacePendingActionKeys(nextPendingActionKeys);
    return true;
  };

  const clearPendingAction = (actionKey: string) => {
    replacePendingActionKeys(removePendingActionKey(pendingActionKeysRef.current, actionKey));
  };

  const isActionPending = (actionKey: string) => pendingActionKeysRef.current.includes(actionKey);

  const runAction = async (
    action: ActionDescriptor,
    targetId: string,
    params: Record<string, ActionParamValue> | undefined = undefined,
  ) => {
    if (!markActionPending(action.key)) {
      return false;
    }

    try {
      const result = await executePluginAction({
        actionKey: action.key,
        input: { target_type: targetType, target_id: targetId, ...(params ? { params } : {}) },
      });

      if (result.status === "error") {
        toaster.create({ type: "error", title: action.label, description: result.message });
        return false;
      }

      if (result.message) {
        toaster.create({ type: "success", title: action.label, description: result.message });
      }

      await onSuccess?.(result);
      return true;
    } finally {
      clearPendingAction(action.key);
    }
  };

  const trigger = async (actionKey: string, targetId: string) => {
    const action = pluginActions?.find((item) => item.key === actionKey);
    if (!action) return;
    if (isActionPending(action.key)) return;

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
    isActionsLoading: pluginActionsQuery.isPending || (pluginActionsQuery.isFetching && !pluginActions),
    activeParamAction: activeParamRequest?.action ?? null,
    trigger,
    submitWithParams,
    cancelParams,
    pendingActionKeys,
    isActionPending,
    activeParamActionIsPending: activeParamRequest ? isActionPending(activeParamRequest.action.key) : false,
    isExecuting: pendingActionKeys.length > 0,
  };
};
