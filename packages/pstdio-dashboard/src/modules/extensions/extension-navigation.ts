import type { NavigationTarget as ExtensionNavigationTarget } from "@pstdio/sdk/extensions";
import type { Disposable, TreeNode, TreeViewSection, WorkbenchModuleContext } from "@pstdio/workbench";
import { toWorkbenchNavigationTarget, toWorkbenchWhenExpression } from "@pstdio/workbench/extensions";
import type { ResolvedWorkbenchExtensionMetadata } from "@/shared/extensions/extension-localization";
import { buildDashboardWorkbenchWhenExpression } from "@/shared/extensions/workbench-extension-contributions";
import { registerSidenavContribution } from "@/shared/workbench/contributions/sidenav-tree-contributions";

type NavigationItem = ResolvedWorkbenchExtensionMetadata["navigationItems"][number];

export const projectNavigationSlotId = "project.navigation";

const isProjectNavigationItem = (item: NavigationItem) =>
  item.slot.extensionId === "pstdio" && item.slot.id === projectNavigationSlotId;

const byOrderAndId = (left: NavigationItem, right: NavigationItem) =>
  (left.order ?? 0) - (right.order ?? 0) || left.id.localeCompare(right.id);

const isVisible = (ctx: WorkbenchModuleContext, item: NavigationItem) =>
  ctx.context.matches(buildDashboardWorkbenchWhenExpression(toWorkbenchWhenExpression(item.when)));

const toNode = (item: NavigationItem): TreeNode => ({
  id: item.id,
  label: item.label,
  icon: item.icon,
  canHide: true,
  target: toWorkbenchNavigationTarget(item.action as ExtensionNavigationTarget, { extensionId: item.extensionId }),
});

const toSections = (ctx: WorkbenchModuleContext, items: NavigationItem[]) => {
  const groups = new Map<string, NavigationItem[]>();
  for (const item of items.filter((candidate) => isVisible(ctx, candidate)).sort(byOrderAndId)) {
    const group = item.group ?? "Extensions";
    groups.set(group, [...(groups.get(group) ?? []), item]);
  }

  return [...groups].map(
    ([group, groupItems]): TreeViewSection => ({
      id: group || "extensions",
      label: group || undefined,
      collapsible: false,
      nodes: groupItems.map(toNode),
    }),
  );
};

export const registerExtensionNavigation = (
  ctx: WorkbenchModuleContext,
  metadata: ResolvedWorkbenchExtensionMetadata,
): Disposable => {
  const items = metadata.navigationItems.filter(isProjectNavigationItem);
  const headerItems = items.filter((item) => item.group === "");
  const bodyItems = items.filter((item) => item.group !== "");
  const registrations = [
    registerSidenavContribution(ctx, {
      id: "dashboard.extensions.project-navigation.header",
      modes: ["*"],
      region: "header",
      order: 40,
      getHeaderNodes: (workbench) =>
        headerItems
          .filter((item) => isVisible(workbench, item))
          .sort(byOrderAndId)
          .map(toNode),
    }),
    registerSidenavContribution(ctx, {
      id: "dashboard.extensions.project-navigation.body",
      modes: ["project"],
      order: 100,
      getSections: (workbench) => toSections(workbench, bodyItems),
    }),
  ];

  return {
    dispose() {
      for (const registration of registrations) registration.dispose();
    },
  };
};

export const withoutDashboardNavigationItems = (metadata: ResolvedWorkbenchExtensionMetadata) => ({
  ...metadata,
  navigationItems: metadata.navigationItems.filter((item) => !isProjectNavigationItem(item)),
});
