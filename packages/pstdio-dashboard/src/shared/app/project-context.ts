import type { WorkbenchModuleContext } from "@pstdio/workbench";
import type { DashboardProjectSelectionPersistence } from "./project-selection-persistence";

export const dashboardSelectedProjectIdContextKey = "dashboard.project.id";
export const dashboardSelectedProjectNameContextKey = "dashboard.project.name";

type DashboardProjectContext = Pick<WorkbenchModuleContext, "context">;
type DashboardProjectSelectionContext = {
  context: Pick<WorkbenchModuleContext["context"], "delete" | "set">;
};
type DashboardProjectSelection = { id: string; name: string };

export const getDashboardSelectedProjectId = (ctx: DashboardProjectContext) => {
  const value = ctx.context.get(dashboardSelectedProjectIdContextKey);
  return typeof value === "string" ? value : undefined;
};

export const getDashboardSelectedProjectName = (ctx: DashboardProjectContext) => {
  const value = ctx.context.get(dashboardSelectedProjectNameContextKey);
  return typeof value === "string" ? value : undefined;
};

export const selectDashboardProject = (
  ctx: DashboardProjectSelectionContext,
  project: DashboardProjectSelection,
  persistence?: DashboardProjectSelectionPersistence,
) => {
  persistence?.setSelectedProjectId(project.id);
  ctx.context.set(dashboardSelectedProjectIdContextKey, project.id);
  ctx.context.set(dashboardSelectedProjectNameContextKey, project.name);
};

export const clearDashboardProjectSelection = (
  ctx: DashboardProjectSelectionContext,
  persistence?: DashboardProjectSelectionPersistence,
) => {
  ctx.context.delete(dashboardSelectedProjectIdContextKey);
  ctx.context.delete(dashboardSelectedProjectNameContextKey);
  persistence?.setSelectedProjectId(undefined);
};

export const subscribeDashboardSelectedProject = (ctx: DashboardProjectContext, listener: () => void) =>
  ctx.context.store.subscribeSelector((state) => state.values[dashboardSelectedProjectIdContextKey], listener);
