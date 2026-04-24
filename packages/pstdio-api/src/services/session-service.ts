import type { createSessionsDBService } from "pstdio-db";
import { createSessionStore } from "../features/sessions/session-store";
import type { EventBus } from "../features/sync/event-bus";

type SessionStatus = "in_progress" | "awaiting_input" | "completed" | "failed" | "cancelled" | "disconnected";

type SessionRecord = { id: string; project_id: string; status: string; original_session_id?: string | null };

export type SessionServiceDeps = {
  sessionsDb: ReturnType<typeof createSessionsDBService>;
  eventBus: EventBus;
  onSessionStarted?: (session: SessionRecord) => void;
  onSessionStatusChanged?: (session: SessionRecord) => void;
  onSessionResumed?: (session: SessionRecord) => void;
};

type CreateSessionOptions = {
  emitStartedHook?: boolean;
};

export const createSessionService = (deps: SessionServiceDeps) => {
  const raw = deps.sessionsDb;
  const store = createSessionStore();

  // --- reads ---
  const get = raw.get;
  const list = raw.list;
  const listByStatus = raw.listByStatus;
  const listByAgentSession = raw.listByAgentSession;

  // --- mutations (orchestrated) ---
  const transitionStatus = async (id: string, status: SessionStatus) => {
    const updated = await raw.updateStatus(id, status);
    if (!updated) return null;

    deps.eventBus.emit("sessions", "set", updated);
    if (updated.project_id) {
      deps.onSessionStatusChanged?.({
        id: updated.id,
        project_id: updated.project_id,
        status: updated.status,
        original_session_id: updated.original_session_id,
      });
    }
    return updated;
  };

  const cancel = async (id: string) => {
    const entry = store.get(id);
    entry?.process?.kill();

    const updated = await transitionStatus(id, "cancelled");
    if (updated) {
      entry?.eventStore.push({ op: "replace", path: "/status", value: "cancelled" });
    }

    return updated;
  };

  const create = async (input: Parameters<typeof raw.create>[0], options: CreateSessionOptions = {}) => {
    const session = await raw.create(input);
    deps.eventBus.emit("sessions", "set", session);
    if (options.emitStartedHook !== false) {
      deps.onSessionStarted?.({
        id: session.id,
        project_id: input.project_id,
        status: session.status,
        original_session_id: session.original_session_id,
      });
    }
    return session;
  };

  const update = raw.update;

  const archive = async (id: string) => {
    const updated = await raw.archive(id);
    if (!updated) return null;

    deps.eventBus.emit("sessions", "set", updated);
    return updated;
  };

  const resume = async (id: string) => {
    const updated = await raw.updateStatus(id, "in_progress");
    if (!updated) return null;

    deps.eventBus.emit("sessions", "set", updated);
    if (updated.project_id) {
      deps.onSessionResumed?.({
        id: updated.id,
        project_id: updated.project_id,
        status: updated.status,
        original_session_id: updated.original_session_id,
      });
    }
    return updated;
  };

  return {
    get,
    list,
    listByStatus,
    listByAgentSession,
    create,
    update,
    transitionStatus,
    cancel,
    archive,
    resume,
    store,
  };
};
