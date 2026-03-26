import type { SessionHookName } from "pstdio-wt";
import type { RouteDeps } from "../deps";
import { fireHook } from "../hooks/fire-hook";

type SessionStatus = "in_progress" | "awaiting_input" | "completed" | "failed" | "cancelled";

const STATUS_TO_HOOK: Partial<Record<SessionStatus, SessionHookName>> = {
  completed: "post-session-success",
  failed: "post-session-fail",
  awaiting_input: "post-session-await-input",
};

type SessionRecord = {
  id: string;
  project_id: string;
  status: string;
};

export const fireSessionStatusHook = (deps: Pick<RouteDeps, "reposService">, session: SessionRecord) => {
  const hookName = STATUS_TO_HOOK[session.status as SessionStatus];
  if (!hookName) return;

  // Fire-and-forget
  void fireHook(deps, {
    hookName,
    projectId: session.project_id,
    payload: { session: { id: session.id, status: session.status } },
  }).catch(() => {});
};

export const fireSessionStartHook = (deps: Pick<RouteDeps, "reposService">, session: SessionRecord) => {
  void fireHook(deps, {
    hookName: "post-session-start",
    projectId: session.project_id,
    payload: { session: { id: session.id, status: session.status } },
  }).catch(() => {});
};

export const fireSessionResumeHook = (deps: Pick<RouteDeps, "reposService">, session: SessionRecord) => {
  void fireHook(deps, {
    hookName: "post-session-resume",
    projectId: session.project_id,
    payload: { session: { id: session.id, status: session.status } },
  }).catch(() => {});
};
