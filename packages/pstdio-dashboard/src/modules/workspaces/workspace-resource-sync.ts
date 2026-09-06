import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { setResourceBreadcrumb } from "@/shared/workbench/resource-sync";
import { createDashboardWorkspaces } from "./data/dashboard-workspaces";
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
      metadata: { ...primary.metadata, ...current.resource.metadata },
    };
    if (primary.label === resource.label && JSON.stringify(primary.metadata) === JSON.stringify(resource.metadata))
      return;
    setResourceBreadcrumb(ctx, resource);
  };
  const unsubscribeData = subscribeDashboardData(sync);
  // Resolve after the page commits so a ticket-to-workspace transition keeps its exact parent.
  const unsubscribePage = ctx.pages.store.subscribe(sync);
  return {
    dispose: () => {
      unsubscribeData();
      unsubscribePage();
    },
  };
};
