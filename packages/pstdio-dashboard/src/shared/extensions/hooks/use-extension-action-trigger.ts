import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import { toaster } from "@pstdio/ui";
import { useParams } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { addPendingActionKey, removePendingActionKey } from "../action-state";
import type { ActionParamValue } from "../action-types";
import { getSlotContributionsForSlots } from "../contribution-mapping";
import {
  buildExtensionActionDescriptor,
  type ExtensionActionDescriptor,
  mapExtensionActionParams,
} from "../extension-action-params";
import { buildExtensionCommandRequest } from "../slot-context";
import type { ExtensionResourceContext } from "../types";
import { useExecuteExtensionCommand, useProjectExtensionMetadata } from "./use-project-extensions";

interface UseExtensionActionTriggerInput {
  slotId: string | string[];
  resource?: ExtensionResourceContext;
  enabled?: boolean;
  onSuccess?: (response: CommandExecuteResponse) => void | Promise<void>;
}

type ActiveParamRequest = {
  action: ExtensionActionDescriptor;
  resource?: ExtensionResourceContext;
};

export const useExtensionActionTrigger = (input: UseExtensionActionTriggerInput) => {
  const { slotId, resource, enabled = true, onSuccess } = input;
  const { projectId } = useParams({ strict: false });
  const { data } = useProjectExtensionMetadata(projectId);
  const executeCommand = useExecuteExtensionCommand(projectId);
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

  const slotIds = Array.isArray(slotId) ? slotId : [slotId];
  const commandsById = new Map((data?.commands ?? []).map((command) => [command.id, command]));
  const contributions =
    projectId && enabled ? getSlotContributionsForSlots(data?.menuContributions ?? [], slotIds) : [];
  const getActionsForResource = (actionResource: ExtensionResourceContext | undefined = resource) =>
    contributions.map((contribution) =>
      buildExtensionActionDescriptor({
        contribution,
        command: commandsById.get(contribution.commandId),
        resource: actionResource,
      }),
    );
  const actions = getActionsForResource(resource);

  const runAction = async (
    action: ExtensionActionDescriptor,
    actionResource: ExtensionResourceContext | undefined,
    params: Record<string, ActionParamValue> | undefined = undefined,
  ) => {
    if (!projectId || !markActionPending(action.key)) {
      return false;
    }

    try {
      const response = await executeCommand.mutateAsync({
        commandId: action.commandId,
        body: buildExtensionCommandRequest({
          projectId,
          slotId: action.slotId,
          kind: "menu",
          params: {
            ...action.contributionParams,
            ...action.baseParams,
            ...(params ? mapExtensionActionParams(params) : {}),
          },
          resource: actionResource,
        }),
      });

      await onSuccess?.(response);
      return response.outcome.status !== "error" && response.outcome.status !== "rejected";
    } catch (error) {
      const message = error instanceof Error ? error.message : "Command could not be executed.";
      toaster.create({ type: "error", title: "Extension command failed", description: message });
      return false;
    } finally {
      clearPendingAction(action.key);
    }
  };

  const trigger = async (actionKey: string, actionResource: ExtensionResourceContext | undefined = resource) => {
    const action = getActionsForResource(actionResource).find((item) => item.key === actionKey);
    if (!action) return;
    if (isActionPending(action.key)) return;

    if (action.params?.length) {
      setActiveParamRequest({ action, resource: actionResource });
      return;
    }

    await runAction(action, actionResource);
  };

  const submitWithParams = async (params: Record<string, ActionParamValue>) => {
    if (!activeParamRequest) return;

    const request = activeParamRequest;
    const didSucceed = await runAction(request.action, request.resource, params);
    if (didSucceed) {
      setActiveParamRequest(null);
    }

    return didSucceed;
  };

  const cancelParams = () => setActiveParamRequest(null);

  return {
    actions,
    getActionsForResource,
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
