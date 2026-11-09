import { resourceKey } from "@pstdio/sdk/extensions";
import { useEffect } from "react";
import type { TreeNode, WorkbenchCore } from "../../../core";
import type { LoadedTreeData } from "./tree-view-load";

export const useTreeResourceRefresh = (
  workbench: WorkbenchCore,
  tree: LoadedTreeData,
  refresh: () => Promise<void>,
) => {
  useEffect(() => {
    const subscription = workbench.resources.preview.subscribeRefresh(async (resource) => {
      const contains = (nodes: TreeNode[]): boolean =>
        nodes.some(
          (node) =>
            (node.resource && resourceKey(node.resource) === resourceKey(resource)) || contains(node.children ?? []),
        );
      if ([...tree.body, ...tree.header, ...tree.footer].some((section) => contains(section.nodes))) await refresh();
    });
    return () => subscription.dispose();
  }, [workbench, tree, refresh]);
};
