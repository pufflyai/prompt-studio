import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { logExtensionHostDiagnostic } from "pstdio-extensions/bridge/host";

const dashboardExtensionsReadyProjectIdContextKey = "dashboard.extensions.readyProjectId";
const dashboardExtensionsRegisteredProjectIdContextKey = "dashboard.extensions.registeredProjectId";

type DashboardExtensionReadinessContext = Pick<WorkbenchModuleContext, "context">;

export const clearDashboardExtensionsReadyProject = (ctx: DashboardExtensionReadinessContext) => {
  ctx.context.delete(dashboardExtensionsReadyProjectIdContextKey);
};

export const setDashboardExtensionsReadyProject = (ctx: DashboardExtensionReadinessContext, projectId: string) => {
  ctx.context.set(dashboardExtensionsReadyProjectIdContextKey, projectId);
  logExtensionHostDiagnostic({ event: "registration-ready", projectId });
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

/**
 * The project whose extension contributions are registered, possibly while a newer catalog read
 * is still loading. Page restoration needs only this; setup decisions wait for the newest read.
 */
export const setDashboardExtensionsRegisteredProject = (ctx: DashboardExtensionReadinessContext, projectId: string) => {
  ctx.context.set(dashboardExtensionsRegisteredProjectIdContextKey, projectId);
};

export const clearDashboardExtensionsRegisteredProject = (ctx: DashboardExtensionReadinessContext) => {
  ctx.context.delete(dashboardExtensionsRegisteredProjectIdContextKey);
};

export const getDashboardExtensionsRegisteredProjectId = (ctx: DashboardExtensionReadinessContext) => {
  const value = ctx.context.get(dashboardExtensionsRegisteredProjectIdContextKey);
  return typeof value === "string" ? value : undefined;
};

export const subscribeDashboardExtensionsRegisteredProject = (
  ctx: DashboardExtensionReadinessContext,
  listener: () => void,
) =>
  ctx.context.store.subscribeSelector(
    (state) => state.values[dashboardExtensionsRegisteredProjectIdContextKey],
    listener,
  );
