import type { ResourceRef, WorkbenchModuleContext } from "@pstdio/workbench";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { createDashboardSessions, type DashboardSession } from "../data/dashboard-sessions";

export const dashboardSelectedSessionIdContextKey = "dashboard.session.id";

type DashboardSessionSelectionContext = Pick<WorkbenchModuleContext, "context">;

export const rememberDashboardSession = (ctx: DashboardSessionSelectionContext, session: DashboardSession) => {
  ctx.context.set(dashboardSelectedSessionIdContextKey, session.id);
};

export const rememberDashboardSessionResource = (
  ctx: DashboardSessionSelectionContext,
  resource: ResourceRef | undefined,
) => {
  if (resource?.kind !== "session" || !resource.id) return;
  ctx.context.set(dashboardSelectedSessionIdContextKey, resource.id);
};

export const forgetDashboardSession = (ctx: DashboardSessionSelectionContext) => {
  ctx.context.delete(dashboardSelectedSessionIdContextKey);
};

export const getDashboardSelectedSessionId = (ctx: DashboardSessionSelectionContext) => {
  const value = ctx.context.get(dashboardSelectedSessionIdContextKey);
  return typeof value === "string" ? value : undefined;
};

export const getDashboardSelectedSession = (ctx: DashboardSessionSelectionContext) => {
  const sessionId = getDashboardSelectedSessionId(ctx);
  if (!sessionId) return undefined;
  return createDashboardSessions(getDashboardSelectedProjectId(ctx)).find((session) => session.id === sessionId);
};

export const subscribeDashboardSelectedSession = (ctx: DashboardSessionSelectionContext, listener: () => void) =>
  ctx.context.store.subscribeSelector((state) => state.values[dashboardSelectedSessionIdContextKey], listener);
