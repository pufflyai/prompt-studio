import { useParams } from "@tanstack/react-router";
import { createElement } from "react";
import { ActionParamsDialog } from "../components/action-params-dialog";
import type { ExtensionResourceContext } from "../types";
import { useExtensionActionTrigger } from "./use-extension-action-trigger";

interface UseExtensionHeaderActionsInput {
  slotId: string;
  resource?: ExtensionResourceContext;
  enabled?: boolean;
}

/**
 * Adapt extension menu contributions into the dashboard's `HeaderActionItem[]` shape so
 * pages can fold extension entries into the existing overflow menu.
 */
export const useExtensionHeaderActions = (input: UseExtensionHeaderActionsInput) => {
  const { projectId } = useParams({ strict: false });
  const actionTrigger = useExtensionActionTrigger(input);

  if (!projectId) {
    return { actions: [], paramsDialog: null, pendingActionKeys: [] };
  }

  const actions = actionTrigger.actions.map((action) => ({
    key: action.key,
    label: action.label,
    kind: "default" as const,
    icon: action.icon,
    presentation: action.presentation,
    isDisabled: actionTrigger.isActionPending(action.key),
    onClick: () => void actionTrigger.trigger(action.key),
  }));

  const paramsDialog =
    actionTrigger.activeParamAction && projectId
      ? createElement(ActionParamsDialog, {
          open: true,
          action: actionTrigger.activeParamAction,
          projectId,
          isSubmitting: actionTrigger.activeParamActionIsPending,
          onClose: actionTrigger.cancelParams,
          onSubmit: actionTrigger.submitWithParams,
        })
      : null;

  return { actions, paramsDialog, pendingActionKeys: actionTrigger.pendingActionKeys };
};
