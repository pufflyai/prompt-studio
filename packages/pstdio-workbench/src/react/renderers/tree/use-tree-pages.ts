import { useEffect, useState, useSyncExternalStore } from "react";
import type { TreeNode, TreeRendererState, WorkbenchCore } from "../../../core";
import { getRendererReadCache } from "../../../core/registries/views/renderer-read-registry";
import { getTreePageOwner, type PagedTreeData, type TreePageIdentity } from "./tree-page-owner";
import { previewTreeResources } from "./tree-resource-preview";
import type { LoadedTreeData } from "./tree-view-load";

const NO_PREVIEWS = new Map();
const NO_SUBSCRIPTION = () => () => {};
const NO_SNAPSHOT = () => undefined;

const bindOwner = (key: string, workbench: WorkbenchCore, identity: TreePageIdentity) => {
  const cache = getRendererReadCache(workbench.views.reads);
  const owner = getTreePageOwner(cache, identity);
  if (!owner) return;
  return { key, owner, subscribe: (listener: () => void) => owner.attach(listener, cache) };
};

export const useTreePages = (
  workbench: WorkbenchCore,
  identity: TreePageIdentity,
  tree: PagedTreeData,
  snapshot: unknown,
  loading: boolean,
  state: TreeRendererState,
) => {
  const key = JSON.stringify(identity);
  const [current, setCurrent] = useState<ReturnType<typeof bindOwner>>();
  // Query identity controls ownership. Tree callbacks and progressive values do not create new owners.
  // biome-ignore lint/correctness/useExhaustiveDependencies: A settled root first becomes available after useRendererRead's commit.
  useEffect(() => {
    setCurrent(bindOwner(key, workbench, identity));
  }, [workbench, key, snapshot !== undefined]);
  const binding = current?.key === key ? current : undefined;
  const result = useSyncExternalStore(
    binding?.subscribe ?? NO_SUBSCRIPTION,
    binding?.owner.sections ?? NO_SNAPSHOT,
    NO_SNAPSHOT,
  );
  useEffect(() => {
    if (loading || current?.key !== key || !current.owner) return;
    current.owner.accept(tree, snapshot);
  }, [current, key, tree, snapshot, loading]);
  const visible = result ?? {
    body: previewTreeResources(tree.body, tree.children, NO_PREVIEWS),
    header: previewTreeResources(tree.header, tree.children, NO_PREVIEWS),
    footer: previewTreeResources(tree.footer, tree.children, NO_PREVIEWS),
  };
  useEffect(() => {
    if (!loading && current?.key === key) void current.owner?.revalidate(visiblePageKeys(visible, state));
  }, [current, key, loading, visible, state]);
  return {
    ...visible,
    loadChildren: (id: string, load: (node: TreeNode, signal: AbortSignal) => Promise<TreeNode[]>, retry?: boolean) =>
      current?.key === key ? (current.owner?.loadChildren(id, load, retry) ?? Promise.resolve()) : Promise.resolve(),
  };
};

const visiblePageKeys = (tree: LoadedTreeData, state: TreeRendererState) => {
  const keys = new Set<string>();
  const nodes = (items: TreeNode[]) => {
    for (const node of items) {
      if (!state.expandedNodeIds.includes(node.id)) continue;
      keys.add(`node:${node.id}`);
      nodes(node.children ?? []);
    }
  };
  for (const section of [...tree.body, ...tree.header, ...tree.footer]) {
    if (section.collapsible !== false && section.label !== undefined && !state.expandedSectionIds.includes(section.id))
      continue;
    keys.add(`section:${section.id}`);
    nodes(section.nodes);
  }
  return keys;
};
