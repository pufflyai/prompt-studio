import { useParams } from "@tanstack/react-router";
import { createElement } from "react";
import { renderHeaderActionIcon } from "../components/action-icons";
import { ActionParamsDialog } from "../components/action-params-dialog";
import type { ExtensionActionDescriptor } from "../extension-action-params";
import type { ExtensionResourceContext } from "../types";
import { useExtensionActionTrigger } from "./use-extension-action-trigger";

interface UseExtensionResourceContextMenuActionsInput {
  slotId: string | string[];
  enabled?: boolean;
}

interface BuildExtensionResourceContextMenuActionsInput {
  actions: ExtensionActionDescriptor[];
  pendingActionKeys?: string[];
  onAction: (actionKey: string) => void;
}

export const buildExtensionResourceContextMenuActions = (input: BuildExtensionResourceContextMenuActionsInput) => {
  const { actions, pendingActionKeys = [], onAction } = input;

  return actions.map((action) => ({
    key: action.key,
    label: action.label,
    icon: renderHeaderActionIcon(action.icon, 16) ?? undefined,
    isDisabled: pendingActionKeys.includes(action.key),
    onClick: () => onAction(action.key),
  }));
};

export const useExtensionResourceContextMenuActions = (input: UseExtensionResourceContextMenuActionsInput) => {
  const { projectId } = useParams({ strict: false });
  const actionTrigger = useExtensionActionTrigger(input);

  const resolveActions = (resource?: ExtensionResourceContext) =>
    buildExtensionResourceContextMenuActions({
      actions: actionTrigger.getActionsForResource(resource),
      pendingActionKeys: actionTrigger.pendingActionKeys,
      onAction: (actionKey) => void actionTrigger.trigger(actionKey, resource),
    });

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

  return { resolveActions, paramsDialog, pendingActionKeys: actionTrigger.pendingActionKeys };
};
