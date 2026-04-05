import type { BaseHookContext } from "../../hooks/base";
import type { ActionTriggerContext } from "../types";

export type PluginHelperContext = Pick<BaseHookContext, "client" | "projectId"> | ActionTriggerContext;

export type TicketRef = {
  ticketId?: string;
};

export type WorkspaceRef = {
  workspaceId?: string;
};

type TicketLike = {
  id: string;
  shorthand: string;
};

type WorkspaceLike = {
  id: string;
  workspace_shorthand: string;
};

export const firstMatch = <T extends { id: string }>(
  values: T[],
  ref: string | undefined,
  readName: (value: T) => string,
) => {
  if (ref) {
    const byIdMatch = values.find((value) => value.id === ref);
    if (byIdMatch) return byIdMatch;

    return values.find((value) => readName(value) === ref) ?? null;
  }

  return null;
};

const readTicketLike = (value: unknown) => {
  if (!value || typeof value !== "object") return null;

  const ticket = value as Partial<TicketLike>;
  if (typeof ticket.id !== "string" || typeof ticket.shorthand !== "string") {
    return null;
  }

  return ticket as TicketLike;
};

const readWorkspaceLike = (value: unknown) => {
  if (!value || typeof value !== "object") return null;

  const workspace = value as Partial<WorkspaceLike>;
  if (typeof workspace.id !== "string" || typeof workspace.workspace_shorthand !== "string") {
    return null;
  }

  return workspace as WorkspaceLike;
};

const matchesRef = (ref: string | undefined, id: string, name: string) => !ref || ref === id || ref === name;

export const readTicketFromContext = (ctx: PluginHelperContext, ref: string | undefined) => {
  const actionTarget =
    "targetType" in ctx && ctx.targetType === "ticket"
      ? readTicketLike((ctx as ActionTriggerContext<"ticket">).target)
      : null;
  if (actionTarget && matchesRef(ref, actionTarget.id, actionTarget.shorthand)) {
    return actionTarget;
  }

  const hookTicket = readTicketLike((ctx as { ticket?: unknown }).ticket);
  if (hookTicket && matchesRef(ref, hookTicket.id, hookTicket.shorthand)) {
    return hookTicket;
  }

  return null;
};

export const readWorkspaceFromContext = (ctx: PluginHelperContext, ref: string | undefined) => {
  const actionTarget =
    "targetType" in ctx && ctx.targetType === "workspace"
      ? readWorkspaceLike((ctx as ActionTriggerContext<"workspace">).target)
      : null;
  if (actionTarget && matchesRef(ref, actionTarget.id, actionTarget.workspace_shorthand)) {
    return actionTarget;
  }

  const hookWorkspace = readWorkspaceLike((ctx as { workspace?: unknown }).workspace);
  if (hookWorkspace && matchesRef(ref, hookWorkspace.id, hookWorkspace.workspace_shorthand)) {
    return hookWorkspace;
  }

  return null;
};

export const resolveSessionIdFromContext = (ctx: PluginHelperContext) => {
  const actionTarget =
    "targetType" in ctx && ctx.targetType === "session" ? (ctx as ActionTriggerContext<"session">).target.id : null;
  if (actionTarget) return actionTarget;

  const originalSessionId = (ctx as { originalSessionId?: unknown }).originalSessionId;
  if (typeof originalSessionId === "string" && originalSessionId.length > 0) {
    return originalSessionId;
  }

  const sessionId = (ctx as { sessionId?: unknown }).sessionId;
  if (typeof sessionId === "string" && sessionId.length > 0) {
    return sessionId;
  }

  return null;
};
