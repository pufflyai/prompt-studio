import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type { NavigationTarget as ExtensionNavigationTarget } from "@pstdio/sdk/extensions";
import { text } from "pstdio-extensions/workbench";
import type {
  Disposable,
  NavigationTreeOwner,
  NavigationTreeSlot,
  TreeNode,
  TreeViewSection,
  WorkbenchModuleContext,
} from "../../core";
import { toWorkbenchNavigationTarget } from "../host/extension-navigation-target";
import { metadataRefId } from "../host/workbench-extension-metadata-ref";

type NavigationItem = WorkbenchExtensionMetadata["navigationItems"][number];
type NavigationTree = WorkbenchExtensionMetadata["navigationTrees"][number];

export interface RegisterWorkbenchExtensionNavigationItemsInput {
  createWhenExpression?: (when: NavigationItem["when"]) => string | undefined;
  metadata: Pick<WorkbenchExtensionMetadata, "navigationItems" | "navigationTrees">;
  workbench: WorkbenchModuleContext;
}

const toOwner = (ref: NavigationItem["owner"] | NavigationTree["owner"]): NavigationTreeOwner => ({
  kind: ref.kind,
  id: metadataRefId(ref),
  extensionId: ref.extensionId,
});

const isVisible = (
  workbench: WorkbenchModuleContext,
  item: NavigationItem,
  createWhenExpression: RegisterWorkbenchExtensionNavigationItemsInput["createWhenExpression"],
) => {
  const expression = createWhenExpression?.(item.when);
  if (!expression) return true;
  return workbench.context.matches(expression);
};

const toNode = (item: NavigationItem): TreeNode => ({
  id: item.id,
  label: text(item.label, item.id),
  icon: item.icon,
  canHide: true,
  canReorder: true,
  target: toWorkbenchNavigationTarget(item.action as ExtensionNavigationTarget, { extensionId: item.extensionId }),
});

const toSections = (
  workbench: WorkbenchModuleContext,
  items: NavigationItem[],
  createWhenExpression: RegisterWorkbenchExtensionNavigationItemsInput["createWhenExpression"],
) => {
  const sections = new Map<string, TreeViewSection>();
  for (const item of items) {
    if (!isVisible(workbench, item, createWhenExpression)) continue;
    const label = item.group || undefined;
    const id = label ? `${item.extensionId}:${label}` : "navigation.root";
    const section = sections.get(id) ?? {
      id,
      label,
      collapsible: Boolean(label),
      canHide: true,
      canReorder: true,
      nodes: [],
    };
    section.nodes.push(toNode(item));
    sections.set(id, section);
  }
  return [...sections.values()];
};

const groupItems = (items: NavigationItem[]) => {
  const groups = new Map<string, NavigationItem[]>();
  for (const item of items) {
    const owner = toOwner(item.owner);
    const key = `${item.extensionId}:${owner.kind}:${owner.id}:${item.slot}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.values()];
};

const defaultExpandedGroupIds = (items: NavigationItem[]) => [
  ...new Set(items.flatMap((item) => (item.group ? [`${item.extensionId}:${item.group}`] : []))),
];

const registerItems = (input: RegisterWorkbenchExtensionNavigationItemsInput) =>
  groupItems(input.metadata.navigationItems).map((items) => {
    const first = items[0]!;
    return input.workbench.navigationTrees.registerContribution({
      id: `${first.extensionId}.navigation-items.${first.owner.kind}.${metadataRefId(first.owner)}.${first.slot}`,
      owner: toOwner(first.owner),
      sourceExtensionId: first.extensionId,
      declarationIndex: input.metadata.navigationItems.indexOf(first),
      slot: first.slot,
      defaultExpandedSectionIds: defaultExpandedGroupIds(items),
      getSections: () => toSections(input.workbench, items, input.createWhenExpression),
    });
  });

const registerTrees = (input: RegisterWorkbenchExtensionNavigationItemsInput) =>
  input.metadata.navigationTrees.map((tree, declarationIndex) => {
    const viewId = metadataRefId(tree.view);
    return input.workbench.navigationTrees.registerContribution({
      id: tree.id,
      idScope: tree.id,
      owner: toOwner(tree.owner),
      sourceExtensionId: tree.extensionId,
      declarationIndex: input.metadata.navigationItems.length + declarationIndex,
      slot: tree.slot as NavigationTreeSlot,
      viewId,
    });
  });

export const registerWorkbenchExtensionNavigationItems = (input: RegisterWorkbenchExtensionNavigationItemsInput) =>
  [...registerItems(input), ...registerTrees(input)] satisfies Disposable[];
