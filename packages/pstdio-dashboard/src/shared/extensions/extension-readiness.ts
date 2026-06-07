import type { WorkbenchModuleContributionContext } from "pstdio-workbench/core";

const dashboardExtensionsReadyProjectIdContextKey = "dashboard.extensions.readyProjectId";

type DashboardExtensionReadinessContext = Pick<WorkbenchModuleContributionContext, "context">;

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
