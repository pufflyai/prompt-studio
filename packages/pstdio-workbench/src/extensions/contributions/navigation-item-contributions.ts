import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { NavigationTarget as ExtensionNavigationTarget } from "@pstdio/sdk/extensions";
import { text } from "pstdio-extensions/workbench";
import type { Disposable, TreeNode, WorkbenchModuleContext, WorkbenchRegion } from "../../core";
import { toWorkbenchNavigationTarget } from "../host/extension-navigation-target";

type NavigationItem = WorkbenchExtensionMetadata["navigationItems"][number];

export interface RegisterWorkbenchExtensionNavigationItemsInput {
  metadata: Pick<WorkbenchExtensionMetadata, "navigationItems">;
  workbench: WorkbenchModuleContext;
}

const regionForSlot = (slotId: string): WorkbenchRegion => {
  if (slotId.includes("main.right")) return "secondary";
  if (slotId.includes("main.left")) return "sidenav";
  return "sidenav";
};

const byOrderAndId = (left: NavigationItem, right: NavigationItem) =>
  (left.order ?? 0) - (right.order ?? 0) || left.id.localeCompare(right.id);

const toNode = (item: NavigationItem): TreeNode => ({
  id: item.id,
  label: text(item.label, item.id),
  icon: item.icon,
  target: toWorkbenchNavigationTarget(item.action as ExtensionNavigationTarget, { extensionId: item.extensionId }),
});

const groupItems = (items: NavigationItem[]) => {
  const groups = new Map<string, NavigationItem[]>();
  for (const item of items) {
    const group = item.group ?? "Extensions";
    groups.set(group, [...(groups.get(group) ?? []), item]);
  }
  return groups;
};

export const registerWorkbenchExtensionNavigationItems = (input: RegisterWorkbenchExtensionNavigationItemsInput) => {
  if (input.metadata.navigationItems.length === 0) return [] as Disposable[];
  const disposables: Disposable[] = [];
  const bySlot = new Map<string, NavigationItem[]>();
  for (const item of input.metadata.navigationItems) {
    bySlot.set(item.slot.id, [...(bySlot.get(item.slot.id) ?? []), item]);
  }

  for (const [slotId, items] of bySlot) {
    const rendererId = `workbench.extension.navigation.${slotId}`;
    const byGroup = groupItems([...items].sort(byOrderAndId));
    disposables.push(
      input.workbench.renderers.registerTreeRenderer({
        id: rendererId,
        title: "Extensions",
        getChildren: (node) => node.children ?? [],
        getBody: () =>
          [...byGroup].map(([group, groupItems]) => ({
            id: group,
            label: group,
            nodes: groupItems.map(toNode),
          })),
      }),
      input.workbench.layout.registerPanel({
        id: rendererId,
        title: "Extensions",
        region: regionForSlot(slotId),
        rendererId,
        singleton: true,
      }),
    );
  }

  return disposables;
};
