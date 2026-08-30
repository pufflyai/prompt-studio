import type { WorkbenchModuleContext } from "@pstdio/workbench";

const dashboardExtensionsReadyProjectIdContextKey = "dashboard.extensions.readyProjectId";
const dashboardExtensionsModuleContextKey = "dashboard.extensions.moduleActive";

type DashboardExtensionReadinessContext = Pick<WorkbenchModuleContext, "context">;

// Presence marker for the extensions module itself. It is set once at activation,
// before any project is selected, so consumers can tell "extension contributions are
// still coming for this project" from "this workbench has no extensions at all"
// without depending on the order in which project-selection subscribers run.
export const markDashboardExtensionsModuleActive = (ctx: DashboardExtensionReadinessContext) => {
  ctx.context.set(dashboardExtensionsModuleContextKey, true);
};

export const clearDashboardExtensionsModuleActive = (ctx: DashboardExtensionReadinessContext) => {
  ctx.context.delete(dashboardExtensionsModuleContextKey);
};

export const hasDashboardExtensionsModule = (ctx: DashboardExtensionReadinessContext) =>
  ctx.context.get(dashboardExtensionsModuleContextKey) === true;

export const clearDashboardExtensionsReadyProject = (ctx: DashboardExtensionReadinessContext) => {
  ctx.context.delete(dashboardExtensionsReadyProjectIdContextKey);
};

export const setDashboardExtensionsReadyProject = (ctx: DashboardExtensionReadinessContext, projectId: string) => {
  ctx.context.set(dashboardExtensionsReadyProjectIdContextKey, projectId);
};

export const getDashboardExtensionsReadyProjectId = (ctx: DashboardExtensionReadinessContext) => {
  const value = ctx.context.get(dashboardExtensionsReadyProjectIdContextKey);
  return typeof value === "string" ? value : undefined;
};

export const subscribeDashboardExtensionsReadyProject = (
  ctx: DashboardExtensionReadinessContext,
  listener: () => void,
) =>
  ctx.context.store.subscribeSelector((state) => state.values[dashboardExtensionsReadyProjectIdContextKey], listener);
