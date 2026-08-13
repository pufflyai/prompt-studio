import { useEffect, useRef, useState } from "react";
import type { ResourceRef, TreeNode, TreeViewSection, WorkbenchCore } from "../../../core";
import {
  expandDefaultTreeSections,
  loadExpandedTreeChildren,
  loadTreeData,
  shouldShowTreeLoading,
} from "./tree-view-load";

export const useTreeData = (
  workbench: WorkbenchCore,
  treeViewId: string,
  resource?: ResourceRef,
  viewId?: string,
  filter?: string,
) => {
  const [header, setHeader] = useState<TreeNode[]>([]);
  const [body, setBody] = useState<TreeViewSection[]>([]);
  const [footer, setFooter] = useState<TreeNode[]>([]);
  const [childrenByNodeId, setChildrenByNodeId] = useState<Record<string, TreeNode[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadedTreeIdRef = useRef<string | null>(null);
  const loadRevisionRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    expandDefaultTreeSections(workbench.renderers, treeViewId);

    const loadTree = () => {
      const loadRevision = ++loadRevisionRef.current;
      if (shouldShowTreeLoading(loadedTreeIdRef.current, treeViewId)) setLoading(true);
      setError(null);
      void loadTreeData(workbench.renderers, treeViewId, { resource, viewId, filter })
        .then(async (data) => {
          if (cancelled || loadRevision !== loadRevisionRef.current) return;
          const treeStillRegistered = workbench.renderers.getTreeRenderer(treeViewId);
          const children =
            data && treeStillRegistered
              ? await loadExpandedTreeChildren(
                  workbench.renderers,
                  treeViewId,
                  data,
                  workbench.renderers.getTreeState(treeViewId).expandedNodeIds,
                  { resource, viewId, filter },
                )
              : {};
          if (cancelled || loadRevision !== loadRevisionRef.current) return;
          loadedTreeIdRef.current = treeViewId;
          setHeader(data?.header ?? []);
          setBody(data?.body ?? []);
          setFooter(data?.footer ?? []);
          setChildrenByNodeId(children);
          setLoading(false);
        })
        .catch((loadError) => {
          if (cancelled || loadRevision !== loadRevisionRef.current) return;
          setError(loadError instanceof Error ? loadError.message : "The file tree could not be loaded.");
          setLoading(false);
        });
    };

    loadTree();
    const disposable = workbench.renderers.onDidRefresh((event) => {
      if (event.treeId === treeViewId) loadTree();
    });
    return () => {
      cancelled = true;
      disposable.dispose();
    };
  }, [filter, resource, viewId, workbench, treeViewId]);

  return { body, childrenByNodeId, error, footer, header, loading, setChildrenByNodeId };
};
