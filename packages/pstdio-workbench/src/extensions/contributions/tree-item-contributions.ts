import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { text } from "pstdio-extensions/workbench";
import type { Disposable, NavigationTarget, TreeNode, WorkbenchModuleContext } from "../../core";
import { resolveWorkbenchTreeRegion } from "../shared/workbench-targets";

type TreeItem = NonNullable<WorkbenchExtensionMetadata["treeItems"]>[number];

export interface RegisterWorkbenchExtensionTreeItemsInput {
  metadata: WorkbenchExtensionMetadata;
  openHref?: (href: string) => unknown;
  workbench: WorkbenchModuleContext;
}

const asParams = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

const targetForTreeAction = (item: TreeItem): NavigationTarget | undefined => {
  const action = item.action;
  if (action.kind === "view") return { kind: "view", viewId: action.viewId };
  if (action.kind === "command") {
    return { kind: "command", commandId: action.commandId, args: action.args };
  }
  if (action.kind === "resource") {
    // Browse-root tree items open a resource directly. The URI matches the
    // scheme extension tree renderer nodes use, so both surfaces share one
    // identity for the same resource.
    return {
      kind: "resource",
      resource: {
        kind: action.resource.type,
        uri: `pstdio://extension-resource/${encodeURIComponent(action.resource.type)}/${encodeURIComponent(action.resource.id)}`,
        id: action.resource.id,
        label: action.resource.label ?? text(item.label, item.id),
        icon: item.icon,
        metadata: action.resource.metadata,
      },
    };
  }
  return { kind: "command", commandId: `workbench.extension.href.${item.id}`, args: { href: action.href } };
};

export const registerWorkbenchExtensionTreeItems = (input: RegisterWorkbenchExtensionTreeItemsInput) => {
  const items = input.metadata.treeItems ?? [];
  if (items.length === 0) return [] as Disposable[];
  const disposables: Disposable[] = [];
  const targets = new Map<string, typeof items>();
  for (const item of items) targets.set(item.target, [...(targets.get(item.target) ?? []), item]);

  for (const [target, targetItems] of targets) {
    const rendererId = `workbench.extension.treeItems.${target}`;
    disposables.push(
      input.workbench.renderers.registerTreeRenderer({
        id: rendererId,
        title: "Extensions",
        getChildren: (node) => node.children ?? [],
        getBody: () => [
          {
            id: "extensions",
            label: "Extensions",
            nodes: targetItems.map(
              (item): TreeNode => ({
                id: item.id,
                label: text(item.label, item.id),
                icon: item.icon,
                target: targetForTreeAction(item),
              }),
            ),
          },
        ],
      }),
      input.workbench.layout.registerPanel({
        id: rendererId,
        title: "Extensions",
        region: resolveWorkbenchTreeRegion(target),
        rendererId,
        singleton: true,
      }),
    );
  }

  for (const item of items.filter((candidate) => candidate.action.kind === "href")) {
    const action = item.action;
    if (action.kind !== "href") continue;
    disposables.push(
      input.workbench.commands.registerCommand(
        { id: `workbench.extension.href.${item.id}`, label: text(item.label, item.id) },
        { execute: (args) => input.openHref?.((asParams(args)?.href as string) ?? action.href) },
      ),
    );
  }

  return disposables;
};
