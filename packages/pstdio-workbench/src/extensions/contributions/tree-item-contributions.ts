import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { text } from "pstdio-extensions/workbench";
import type { Disposable, NavigationTarget, TreeNode, WorkbenchModuleContributionContext } from "../../core";
import { resolveWorkbenchTreeArea } from "../shared/workbench-targets";
import { routeResource } from "./route-contributions";

type TreeItem = NonNullable<WorkbenchExtensionMetadata["treeItems"]>[number];

export interface RegisterWorkbenchExtensionTreeItemsInput {
  metadata: WorkbenchExtensionMetadata;
  openHref?: (href: string) => unknown;
  routeResourceKind: string;
  workbench: WorkbenchModuleContributionContext;
}

const asParams = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

const targetForTreeAction = (
  input: RegisterWorkbenchExtensionTreeItemsInput,
  item: TreeItem,
): NavigationTarget | undefined => {
  if (item.action.kind === "dataRenderer") return { kind: "view", widgetId: item.action.dataRendererId };
  const action = item.action;
  if (action.kind === "route") {
    const route = input.metadata.routes.find((candidate) => candidate.id === action.route);
    return route ? { kind: "resource", resource: routeResource(route, input.routeResourceKind) } : undefined;
  }
  if (action.kind === "command") {
    return { kind: "command", commandId: action.commandId, args: action.args };
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
                target: targetForTreeAction(input, item),
              }),
            ),
          },
        ],
      }),
      input.workbench.layout.registerWidget({
        id: rendererId,
        title: "Extensions",
        area: resolveWorkbenchTreeArea(target),
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
