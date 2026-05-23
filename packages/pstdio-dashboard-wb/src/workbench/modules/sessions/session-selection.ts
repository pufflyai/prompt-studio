import type { ResourceRef, WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import { createDashboardSessions, type DashboardSession } from "../../data/dashboard-data";
import { getDashboardSelectedProjectId } from "../../shared/project-context";

type DashboardSessionSelectionContext = Pick<WorkbenchModuleContributionContext, "context">;

const selectedSessionByWorkbench = new WeakMap<WorkbenchModuleContributionContext["context"]["store"], string>();

export const rememberDashboardSession = (ctx: DashboardSessionSelectionContext, session: DashboardSession) => {
  selectedSessionByWorkbench.set(ctx.context.store, session.id);
};

export const rememberDashboardSessionResource = (
  ctx: DashboardSessionSelectionContext,
  resource: ResourceRef | undefined,
) => {
  if (resource?.kind !== "session" || !resource.id) return;
  selectedSessionByWorkbench.set(ctx.context.store, resource.id);
};

export const getDashboardSelectedSessionId = (ctx: DashboardSessionSelectionContext) =>
  selectedSessionByWorkbench.get(ctx.context.store);

export const getDashboardSelectedSession = (ctx: DashboardSessionSelectionContext) => {
  const sessionId = getDashboardSelectedSessionId(ctx);
  if (!sessionId) return undefined;
  return createDashboardSessions(getDashboardSelectedProjectId(ctx)).find((session) => session.id === sessionId);
};
