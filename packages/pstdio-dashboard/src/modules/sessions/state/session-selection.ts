import type { ResourceRef, WorkbenchModuleContext } from "@pstdio/workbench";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { createDashboardSessions, type DashboardSession } from "../data/dashboard-sessions";
import type { DashboardSessionSelectionPersistence } from "./session-selection-persistence";

type DashboardSessionSelectionContext = Pick<WorkbenchModuleContext, "context">;

interface DashboardSessionSelectionState {
  persistence?: DashboardSessionSelectionPersistence;
  selectedByProject: Map<string, string>;
}

const selectionByWorkbench = new WeakMap<WorkbenchModuleContext["context"]["store"], DashboardSessionSelectionState>();

const getSelectionState = (ctx: DashboardSessionSelectionContext) => {
  const existing = selectionByWorkbench.get(ctx.context.store);
  if (existing) return existing;

  const created: DashboardSessionSelectionState = { selectedByProject: new Map() };
  selectionByWorkbench.set(ctx.context.store, created);
  return created;
};

export const configureDashboardSessionSelectionPersistence = (
  ctx: DashboardSessionSelectionContext,
  persistence: DashboardSessionSelectionPersistence,
) => {
  getSelectionState(ctx).persistence = persistence;
};

const selectedProjectId = (ctx: DashboardSessionSelectionContext) => getDashboardSelectedProjectId(ctx);

const setSelectedSessionId = (ctx: DashboardSessionSelectionContext, sessionId: string | undefined) => {
  const projectId = selectedProjectId(ctx);
  if (!projectId) return;

  const state = getSelectionState(ctx);
  if (sessionId) state.selectedByProject.set(projectId, sessionId);
  else state.selectedByProject.delete(projectId);
  state.persistence?.setSelectedSessionId(projectId, sessionId);
};

export const rememberDashboardSession = (ctx: DashboardSessionSelectionContext, session: DashboardSession) => {
  setSelectedSessionId(ctx, session.id);
};

export const rememberDashboardSessionResource = (
  ctx: DashboardSessionSelectionContext,
  resource: ResourceRef | undefined,
) => {
  if (resource?.kind !== "session" || !resource.id) return;
  setSelectedSessionId(ctx, resource.id);
};

export const forgetDashboardSession = (ctx: DashboardSessionSelectionContext) => {
  setSelectedSessionId(ctx, undefined);
};

export const getDashboardSelectedSessionId = (ctx: DashboardSessionSelectionContext) => {
  const projectId = selectedProjectId(ctx);
  if (!projectId) return undefined;

  const state = getSelectionState(ctx);
  return state.persistence?.getSelectedSessionId(projectId) ?? state.selectedByProject.get(projectId);
};

export const getDashboardSelectedSession = (ctx: DashboardSessionSelectionContext) => {
  const sessionId = getDashboardSelectedSessionId(ctx);
  if (!sessionId) return undefined;
  return createDashboardSessions(getDashboardSelectedProjectId(ctx)).find((session) => session.id === sessionId);
};
