import { useEffect, useRef, useState } from "react";
import { getWorkbenchRenderers, type ResourceRef, type TreeNode, type WorkbenchCore } from "../../../core";
import {
  expandDefaultTreeSections,
  type LoadedTreeData,
  loadExpandedTreeChildren,
  loadTreeData,
} from "./tree-view-load";

export const useTreeData = (
  workbench: WorkbenchCore,
  treeViewId: string,
  resource?: ResourceRef,
  viewId?: string,
  filter?: string,
) => {
  const [data, setData] = useState<(LoadedTreeData & { treeViewId: string; filter?: string }) | null>(null);
  const [childrenByNodeId, setChildrenByNodeId] = useState<Record<string, TreeNode[]>>({});
  const [error, setError] = useState<string | null>(null);
  const loadRevisionRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    expandDefaultTreeSections(getWorkbenchRenderers(workbench), treeViewId);

    const loadTree = () => {
      const loadRevision = ++loadRevisionRef.current;
      setError(null);
      void loadTreeData(getWorkbenchRenderers(workbench), treeViewId, { resource, viewId, filter })
        .then(async (data) => {
          if (cancelled || loadRevision !== loadRevisionRef.current) return;
          const treeStillRegistered = getWorkbenchRenderers(workbench).getTreeRenderer(treeViewId);
          const children =
            data && treeStillRegistered
              ? await loadExpandedTreeChildren(
                  getWorkbenchRenderers(workbench),
                  treeViewId,
                  data,
                  getWorkbenchRenderers(workbench).getTreeState(treeViewId).expandedNodeIds,
                  { resource, viewId, filter },
                )
              : {};
          if (cancelled || loadRevision !== loadRevisionRef.current) return;
          setData({
            header: data?.header ?? [],
            body: data?.body ?? [],
            footer: data?.footer ?? [],
            treeViewId,
            filter,
          });
          setChildrenByNodeId(children);
        })
        .catch((loadError) => {
          if (cancelled || loadRevision !== loadRevisionRef.current) return;
          setError(loadError instanceof Error ? loadError.message : "The file tree could not be loaded.");
        });
    };

    loadTree();
    const disposable = getWorkbenchRenderers(workbench).onDidRefresh((event) => {
      if (event.treeId === treeViewId) loadTree();
    });
    return () => {
      cancelled = true;
      disposable.dispose();
    };
  }, [filter, resource, viewId, workbench, treeViewId]);

  // Refreshes preserve the current tree, but a different query must not expose
  // stale rows that can disappear in the middle of a click.
  const loading = !error && (data?.treeViewId !== treeViewId || data?.filter !== filter);
  return {
    body: data?.body ?? [],
    childrenByNodeId,
    error,
    footer: data?.footer ?? [],
    header: data?.header ?? [],
    loading,
    setChildrenByNodeId,
  };
};
