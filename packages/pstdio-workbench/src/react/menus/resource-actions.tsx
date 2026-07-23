import { Icon } from "@chakra-ui/react";
import type { ResourceContextAction, TreeListActionMenuItem } from "@pstdio/ui";
import type { ResourceRef, WorkbenchCoreContributionContext } from "../../core";
import { resourceContextMenuPath } from "../../core";
import { createTreeContextMenuItems } from "../renderers/tree/tree-actions";
import { useWorkbenchStore } from "../shared/use-workbench-store";

const toResourceContextAction = (item: TreeListActionMenuItem): ResourceContextAction => ({
  key: item.id,
  label: item.label,
  commandId: item.commandId,
  icon: typeof item.icon === "function" ? <Icon as={item.icon} boxSize="16px" /> : item.icon,
  endContent: item.endContent,
  isDisabled: item.disabled,
  separatorBefore: item.separatorBefore,
  onClick: () => item.onAction?.(),
});

export const createWorkbenchResourceActions = (workbench: WorkbenchCoreContributionContext, resource: ResourceRef) =>
  createTreeContextMenuItems({
    menuPath: resourceContextMenuPath(resource.kind),
    workbench,
    context: { resource },
    onRequestParams: ({ request }) => workbench.commandPalette.requestParams(request),
  }).map(toResourceContextAction);

export const useWorkbenchResourceActionResolver = (workbench: WorkbenchCoreContributionContext) => {
  useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  useWorkbenchStore(workbench.context.store, (state) => state.values);
  useWorkbenchStore(workbench.layout.menuStore, (state) => state.itemsByPath);

  return (resource: ResourceRef) => createWorkbenchResourceActions(workbench, resource);
};
