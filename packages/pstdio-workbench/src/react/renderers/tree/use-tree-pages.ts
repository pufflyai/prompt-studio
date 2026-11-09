import { useEffect, useState } from "react";
import type { TreeNode, TreeRendererState } from "../../../core";
import { createTreePages } from "./tree-pages";
import { previewTreeResources } from "./tree-resource-preview";
import type { LoadedTreeData } from "./tree-view-load";

const NO_PREVIEWS = new Map();

export const useTreePages = (
  tree: LoadedTreeData & { children: Record<string, TreeNode[]> },
  snapshot: unknown,
  revision: symbol | undefined,
  scope: string,
  loading: boolean,
  state: TreeRendererState,
) => {
  const [current, setCurrent] = useState<{
    snapshot: unknown;
    revision: symbol | undefined;
    scope: string;
    pages: ReturnType<typeof createTreePages>;
    tree: typeof tree;
  }>();
  // biome-ignore lint/correctness/useExhaustiveDependencies: Snapshots own page reads; lazy-child cache updates merge into that snapshot without restarting its pages.
  useEffect(() => {
    if (loading) return;
    const controller = new AbortController();
    setCurrent((previous) => {
      const retained = previous?.scope === scope ? previous.pages.snapshot() : undefined;
      const pages = createTreePages(
        controller.signal,
        () => setCurrent((value) => (value ? { ...value } : value)),
        retained,
      );
      return { snapshot, revision, scope, pages, tree };
    });
    return () => controller.abort();
  }, [snapshot, revision, scope, loading]);
  useEffect(() => {
    if (!loading)
      setCurrent((previous) =>
        previous && previous.snapshot === snapshot && previous.tree !== tree ? { ...previous, tree } : previous,
      );
  }, [tree, snapshot, loading]);
  const visible =
    current && (!loading && current.snapshot === snapshot && current.revision === revision ? tree : current.tree);
  const result =
    !current || current.scope !== scope || !visible
      ? {
          body: previewTreeResources(tree.body, tree.children, NO_PREVIEWS),
          header: previewTreeResources(tree.header, tree.children, NO_PREVIEWS),
          footer: previewTreeResources(tree.footer, tree.children, NO_PREVIEWS),
        }
      : {
          body: current.pages.sections(visible.body, visible.children),
          header: current.pages.sections(visible.header, visible.children),
          footer: current.pages.sections(visible.footer, visible.children),
        };
  useEffect(() => {
    if (current && !loading && current.snapshot === snapshot && current.scope === scope)
      void current.pages.revalidate(visiblePageKeys(result, state));
  }, [current, loading, snapshot, scope, result, state]);
  return result;
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
