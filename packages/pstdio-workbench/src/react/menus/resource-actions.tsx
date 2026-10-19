import { Icon } from "@chakra-ui/react";
import type { ResourceContextAction, TreeListActionMenuItem } from "@pstdio/ui";
import { useEffect, useState } from "react";
import type { ResourceRef, WorkbenchCoreContributionContext } from "../../core";
import { workbenchBreadcrumbLocationMenuPath } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { type CreateMenuItemsInput, createMenuItems } from "./command-menu-items";
import { resolveResourceActionMenu, subscribeResourceKinds } from "./resource-action-menu";

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
export const createWorkbenchResourceActions = (
  workbench: WorkbenchCoreContributionContext,
  subject: ResourceRef,
  options: Pick<CreateMenuItemsInput, "onRequestParams" | "onCommandError"> = {},
) => {
  const menu = resolveResourceActionMenu(workbench, subject, options.onRequestParams);
  if (!menu) return [];
  return createMenuItems({ ...menu, onCommandError: options.onCommandError }).map((item) => ({
    ...toResourceContextAction(item),
    group: item.group ?? menu.group,
  }));
};
export const createWorkbenchLocationActions = (
  workbench: WorkbenchCoreContributionContext,
  resource: ResourceRef | undefined,
) =>
  createMenuItems({
    menuPath: workbenchBreadcrumbLocationMenuPath,
    workbench,
    context: resource ? { resource } : undefined,
    onRequestParams: ({ request }) => workbench.commandPalette.requestParams(request),
  }).map(toResourceContextAction);
export const useWorkbenchResourceActionResolver = (workbench: WorkbenchCoreContributionContext) => {
  useWorkbenchStore(workbench.resources.preview.store, (state) => state.changes);
  const kinds = useWorkbenchStore(workbench.resources.store, (state) => state.kinds);
  const [, refresh] = useState(0);
  useEffect(() => subscribeResourceKinds(Object.values(kinds), () => refresh((revision) => revision + 1)), [kinds]);
  useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  useWorkbenchStore(workbench.context.store, (state) => state.values);
  useWorkbenchStore(workbench.layout.menuStore, (state) => state.itemsByPath);
  return (resource: ResourceRef) => createWorkbenchResourceActions(workbench, resource);
};
