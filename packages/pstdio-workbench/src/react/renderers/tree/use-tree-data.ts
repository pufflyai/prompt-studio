import { resourceKey } from "@pstdio/sdk/extensions";
import { useSyncExternalStore } from "react";
import { getWorkbenchRenderers, type ResourceRef, type WorkbenchCore } from "../../../core";
import { useWorkbenchStore } from "../../shared/use-workbench-store";
import { useRendererRead } from "../use-renderer-read";
import { expandDefaultTreeSections, loadExpandedTreeChildren, loadTreeData } from "./tree-view-load";

export const useTreeData = (
  workbench: WorkbenchCore,
  treeViewId: string,
  resource?: ResourceRef,
  viewId?: string,
  filter?: string,
  ownerKey = JSON.stringify(["tree", treeViewId, resourceKey(resource)]),
) => {
  const trees = getWorkbenchRenderers(workbench);
  const mode = useWorkbenchStore(workbench.modes.store, (state) => state.activeModeId);
  const location = useWorkbenchStore(workbench.pages.store, (state) => state.location);
  const project = useWorkbenchStore(workbench.pages.store, (state) => state.projectId);
  const activePage = useWorkbenchStore(workbench.pages.store, (state) => state.activePageId);
  const getPageOwner = () => (activePage ? workbench.navigationTrees.resolveOwner("page", activePage) : undefined);
  const pageOwner = useSyncExternalStore(
    (listener) => {
      const subscription = workbench.navigationTrees.onDidChange(listener);
      return () => subscription.dispose();
    },
    getPageOwner,
    getPageOwner,
  );
  const read = useRendererRead({
    workbench,
    ownerKey,
    // Shell trees also query the current mode and resource. Aggregate pages in
    // the same scope share navigation, so their global links stay mounted.
    queryKey: JSON.stringify([
      treeViewId,
      resourceKey(resource),
      viewId,
      filter,
      project,
      mode,
      pageOwner,
      resourceKey(location?.resource),
    ]),
    load: async (signal) => {
      expandDefaultTreeSections(trees, treeViewId);
      const ctx = { resource, viewId, filter, signal };
      const data = await loadTreeData(trees, treeViewId, ctx);
      signal.throwIfAborted();
      const children =
        data && trees.getTreeRenderer(treeViewId)
          ? await loadExpandedTreeChildren(trees, treeViewId, data, trees.getTreeState(treeViewId).expandedNodeIds, ctx)
          : {};
      return { header: data?.header ?? [], body: data?.body ?? [], footer: data?.footer ?? [], children };
    },
    subscribe: (refresh) =>
      trees.onDidRefresh((event) => {
        if (event.treeId === treeViewId) refresh();
      }),
  });
  return {
    body: read.value?.body ?? [],
    header: read.value?.header ?? [],
    footer: read.value?.footer ?? [],
    childrenByNodeId: read.value?.children ?? {},
    error: read.error ?? null,
    loading: read.loading && !read.value,
    retry: read.retry,
  };
};
