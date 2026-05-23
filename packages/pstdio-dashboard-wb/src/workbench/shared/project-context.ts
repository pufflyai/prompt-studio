import type { WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import type { DashboardProject } from "../data/project-data";
import type { DashboardProjectSelectionPersistence } from "./project-selection-persistence";

export const dashboardSelectedProjectIdContextKey = "dashboard.project.id";
export const dashboardSelectedProjectNameContextKey = "dashboard.project.name";

type DashboardProjectContext = Pick<WorkbenchModuleContributionContext, "context">;
type DashboardProjectSelectionContext = {
  context: Pick<WorkbenchModuleContributionContext["context"], "set">;
};

export const getDashboardSelectedProjectId = (ctx: DashboardProjectContext) => {
  const value = ctx.context.get(dashboardSelectedProjectIdContextKey);
  return typeof value === "string" ? value : undefined;
};

export const selectDashboardProject = (
  ctx: DashboardProjectSelectionContext,
  project: Pick<DashboardProject, "id" | "name">,
  persistence?: DashboardProjectSelectionPersistence,
) => {
  ctx.context.set(dashboardSelectedProjectIdContextKey, project.id);
  ctx.context.set(dashboardSelectedProjectNameContextKey, project.name);
  persistence?.setSelectedProjectId(project.id);
};

export const subscribeDashboardSelectedProject = (ctx: DashboardProjectContext, listener: () => void) =>
  ctx.context.store.subscribeSelector((state) => state.values[dashboardSelectedProjectIdContextKey], listener);
