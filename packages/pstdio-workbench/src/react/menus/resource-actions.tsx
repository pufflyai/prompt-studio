import { Icon } from "@chakra-ui/react";
import type { ResourceContextAction, TreeListActionMenuItem } from "@pstdio/ui";
import { useEffect, useState } from "react";
import type { ResourceRef, WorkbenchCoreContributionContext } from "../../core";
import { resourceContextMenuPath, workbenchBreadcrumbLocationMenuPath } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { type CreateMenuItemsInput, createMenuItems } from "./command-menu-items";

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
  const kind = workbench.resources.getKind(subject.type, subject.extensionId);
  const current = kind?.resolve ? kind.resolve(subject) : subject;
  const resource = current ? workbench.resources.preview.resolve(current) : undefined;
  if (!resource) return [];
  return createMenuItems({
    menuPath: resourceContextMenuPath(resource.type),
    workbench,
    context: { resource },
    onRequestParams: options.onRequestParams ?? (({ request }) => workbench.commandPalette.requestParams(request)),
    onCommandError: options.onCommandError,
  }).map((item) => ({
    ...toResourceContextAction(item),
    group: item.group ?? {
      id: `resource:${resource.extensionId ?? "pstdio"}:${resource.type}`,
      label: kind?.label ?? resource.type,
    },
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
  useEffect(() => {
    const subscriptions = Object.values(kinds).flatMap((kind) =>
      kind.subscribe ? [kind.subscribe(() => refresh((revision) => revision + 1))] : [],
    );
    return () => {
      for (const subscription of subscriptions) {
        if (typeof subscription === "function") subscription();
        else subscription.dispose();
      }
    };
  }, [kinds]);
  useWorkbenchStore(workbench.commands.store, (state) => state.commands);
  useWorkbenchStore(workbench.context.store, (state) => state.values);
  useWorkbenchStore(workbench.layout.menuStore, (state) => state.itemsByPath);
  return (resource: ResourceRef) => createWorkbenchResourceActions(workbench, resource);
};
