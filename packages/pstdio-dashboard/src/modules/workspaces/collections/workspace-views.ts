import type { DataTableRendererSettings } from "@pstdio/sdk/extensions";
import type { CollectionViewsProvider, WorkbenchModuleContext } from "@pstdio/workbench";
import { dataTableBuiltInViews, WORKSPACES_COLLECTION_ID, workspaceCollectionDefaults } from "pstdio-api-contracts";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import { createSharedCollectionViews } from "@/shared/collections/collection-views";

export const createWorkspaceViewsProvider = (ctx: WorkbenchModuleContext) => {
  let projectId: string | undefined;
  let provider: CollectionViewsProvider<DataTableRendererSettings> | undefined;
  const selected = () => {
    const current = getDashboardSelectedProjectId(ctx);
    if (current !== projectId) {
      projectId = current;
      const record = { id: WORKSPACES_COLLECTION_ID, defaultSettings: workspaceCollectionDefaults };
      provider = current
        ? createSharedCollectionViews({
            projectId: current,
            extensionInstanceId: null,
            localId: record.id,
            record,
            builtIns: dataTableBuiltInViews(record).views.map((view) => ({ ...view, title: String(view.title) })),
          })
        : undefined;
    }
    return provider;
  };
  return {
    getSnapshot: () => selected()?.getSnapshot(),
    subscribe: (listener: () => void) => {
      let stopViews = selected()?.subscribe(listener);
      const stopProject = subscribeDashboardSelectedProject(ctx, () => {
        stopViews?.();
        stopViews = selected()?.subscribe(listener);
        listener();
      });
      return () => {
        stopProject();
        stopViews?.();
      };
    },
  };
};
