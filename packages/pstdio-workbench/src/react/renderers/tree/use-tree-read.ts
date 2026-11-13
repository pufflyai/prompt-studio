import { resourceKey } from "@pstdio/sdk/extensions";
import { useSyncExternalStore } from "react";
import {
  getWorkbenchRenderers,
  type ResourceRef,
  type TreeNode,
  type WorkbenchCore,
  type WorkbenchPanelInstance,
} from "../../../core";
import { resolveNavigationLevels } from "../../../core/controllers/page-location/navigation-level";
import { useOptionalWorkbenchStore } from "../../shared/use-workbench-store";
import { usePageParams } from "../use-page-params";
import { useRendererRead } from "../use-renderer-read";
import { type LoadedTreeData, loadExpandedTreeChildren, loadTreeData, treeStructure } from "./tree-view-load";

const treeQueryScope = (workbench: WorkbenchCore, id: string, projectId: string | undefined) =>
  getWorkbenchRenderers(workbench).getTreeRenderer(id)?.queryScope ?? { projectId };

const emptyChanges: ReturnType<WorkbenchCore["resources"]["preview"]["store"]["getState"]>["changes"] = new Map();

export const useTreeRead = (
  workbench: WorkbenchCore,
  treeViewId: string,
  resource?: ResourceRef,
  viewId?: string,
  filter?: string,
  ownerKey = JSON.stringify(["tree", treeViewId, viewId]),
  placement?: WorkbenchPanelInstance,
  enabled = true,
) => {
  const pageParams = usePageParams(workbench, placement, enabled);
  // Look the renderers up where they are used: React Compiler treats a held call result as mutable until its
  // last use, and cannot cache anything whose inputs stay mutable across the hooks below.
  const changes =
    useOptionalWorkbenchStore(enabled ? workbench.resources.preview.store : undefined, (state) => state.changes) ??
    emptyChanges;
  useOptionalWorkbenchStore(
    enabled ? getWorkbenchRenderers(workbench).treeStore : undefined,
    (state) => state.refreshKeysByTreeId[treeViewId],
  );
  const mode = useOptionalWorkbenchStore(enabled ? workbench.modes.store : undefined, (state) => state.activeModeId);
  const location = useOptionalWorkbenchStore(enabled ? workbench.pages.store : undefined, (state) => state.location);
  const project = useOptionalWorkbenchStore(enabled ? workbench.pages.store : undefined, (state) => state.projectId);
  const getPageOwner = () =>
    enabled
      ? JSON.stringify(
          resolveNavigationLevels({
            location,
            pages: Object.values(workbench.pages.store.getState().pages),
            navigationTrees: workbench.navigationTrees,
          }).map(({ owner, location }) => [owner, resourceKey(location.resource)]),
        )
      : "";
  const navigationRegistrations = useSyncExternalStore(
    (listener) => {
      if (!enabled) return () => {};
      const subscription = workbench.navigationTrees.onDidChange(listener);
      return () => subscription.dispose();
    },
    () => (enabled ? workbench.navigationTrees.getRegistrationRevision() : 0),
    () => (enabled ? workbench.navigationTrees.getRegistrationRevision() : 0),
  );
  const pageOwner = useSyncExternalStore(
    (listener) => {
      if (!enabled) return () => {};
      const subscription = workbench.navigationTrees.onDidChange(listener);
      return () => subscription.dispose();
    },
    getPageOwner,
    getPageOwner,
  );
  // A new owner or bound resource starts with its structure. Selecting a child page
  // refreshes the same owner's data without removing its mounted rows.
  const scope = getWorkbenchRenderers(workbench)
    .getTreeRenderer(treeViewId)
    ?.getReadKey?.({ resource, viewId, filter, pageParams });
  const queryScope = treeQueryScope(workbench, treeViewId, resource?.projectId ?? project);
  const refreshKey = JSON.stringify(scope ?? [resourceKey(resource), resourceKey(location?.resource), mode, pageOwner]);
  const queryKey = JSON.stringify([
    treeViewId,
    viewId,
    project,
    resourceKey(resource),
    filter,
    pageParams,
    mode,
    pageOwner,
  ]);
  const childrenKey = JSON.stringify([queryKey, refreshKey]);
  // A renderer's structure can read workbench state beyond its context, such as the navigation level. The read
  // keys capture that state, so the structure is read again whenever they change.
  const readStructure = (_readKey: string) =>
    treeStructure(getWorkbenchRenderers(workbench).getTreeRenderer(treeViewId), {
      resource,
      viewId,
      filter,
      pageParams,
    });
  const structure = readStructure(childrenKey);

  const read = useRendererRead<LoadedTreeData & { children: Record<string, TreeNode[]> }>({
    enabled,
    workbench,
    ownerKey,
    sourceId: treeViewId,
    queryScope,
    queryEvents: getWorkbenchRenderers(workbench).getTreeRenderer(treeViewId)?.queryEvents,
    queryKey,
    refreshKey,
    load: async (signal, publish) => {
      const ctx = { resource, viewId, filter, signal, pageParams };
      const trees = getWorkbenchRenderers(workbench);
      const data = await loadTreeData(trees, treeViewId, ctx, (available) => publish({ ...available, children: {} }));
      signal.throwIfAborted();
      const children =
        data && trees.getTreeRenderer(treeViewId)
          ? await loadExpandedTreeChildren(trees, treeViewId, data, trees.getTreeState(treeViewId).expandedNodeIds, ctx)
          : {};
      return {
        header: data?.header ?? [],
        body: data?.body ?? [],
        footer: data?.footer ?? [],
        children,
      };
    },
  });
  return {
    read,
    structure,
    queryKey,
    queryScope,
    refreshKey,
    childrenKey,
    changes,
    navigationRegistrations,
    pageParams,
  };
};
