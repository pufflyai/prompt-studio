import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { setResourceBreadcrumb } from "@/shared/workbench/resource-sync";
import { createDashboardWorkspaces } from "@/shared/workspaces/dashboard-workspaces";

const fileAvailability = (metadata: Record<string, unknown> | undefined) =>
  JSON.stringify([metadata?.workspaceProviderState, metadata?.workspacePath]);

export const watchOpenWorkspaceResource = (ctx: WorkbenchModuleContext) => {
  const sync = () => {
    const location = ctx.pages.store.getState().location;
    const primary = ctx.getPrimaryResource();
    if (location?.resource?.type !== "workspace" || primary?.type !== "workspace") return;
    const current = createDashboardWorkspaces(getDashboardSelectedProjectId(ctx)).find(
      (workspace) => workspace.id === location.resource?.id,
    );
    if (!current) return;
    const resource = {
      ...primary,
      ...current.resource,
      metadata: {
        ...primary.metadata,
        ...current.resource.metadata,
        ...(location.resource.metadata?.workspaceFilePath
          ? { workspaceView: "files", workspaceFilePath: location.resource.metadata.workspaceFilePath }
          : {}),
      },
    };
    if (
      primary.label === resource.label &&
      primary.icon === resource.icon &&
      JSON.stringify(primary.metadata) === JSON.stringify(resource.metadata)
    )
      return;
    setResourceBreadcrumb(ctx, resource);
    // Tree reads key on the workspace's identity. A workspace that becomes ready, or gets its project
    // folder on this device, has new files to show.
    if (fileAvailability(primary.metadata) !== fileAvailability(resource.metadata))
      ctx.views.refreshView(dashboardWidgetIds.workspaceFileTree);
  };
  const unsubscribeData = subscribeDashboardData((change) => {
    if (!change || change.table === "workspaces") sync();
  });
  // Resolve after the page commits so a ticket-to-workspace transition keeps its exact parent.
  const unsubscribePage = ctx.pages.store.subscribe(sync);
  return {
    dispose: () => {
      unsubscribeData();
      unsubscribePage();
    },
  };
};
