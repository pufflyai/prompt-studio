import type { createSessionQueueEntriesDBService, createSessionsDBService } from "pstdio-db";
import { createSessionStore } from "../features/sessions/session-store";
import type { EventBus } from "../features/sync/event-bus";

type SessionStatus =
  | "in_progress"
  | "awaiting_input"
  | "queued"
  | "completed"
  | "failed"
  | "cancelled"
  | "disconnected";

type SessionRecord = { id: string; project_id: string | null; status: string; original_session_id?: string | null };
type HookSessionRecord = { id: string; project_id: string; status: string; original_session_id?: string | null };

export type SessionServiceDeps = {
  sessionsDb: ReturnType<typeof createSessionsDBService>;
  sessionQueueEntriesService?: ReturnType<typeof createSessionQueueEntriesDBService>;
  eventBus: EventBus;
  onSessionStarted?: (session: HookSessionRecord) => void;
  onSessionStatusChanged?: (session: HookSessionRecord) => void;
  onSessionResumed?: (session: HookSessionRecord) => void;
  onCapacityAvailable?: () => Promise<void>;
};

type CreateSessionOptions = {
  emitStartedHook?: boolean;
};

type ResumeSessionOptions = {
  emitResumedHook?: boolean;
};

type TransitionStatusOptions = {
  drainCapacity?: boolean;
};

const releasesCapacity = (status: SessionStatus) =>
  status === "completed" || status === "failed" || status === "cancelled" || status === "disconnected";

export const createSessionService = (deps: SessionServiceDeps) => {
  const raw = deps.sessionsDb;
  const store = createSessionStore();

  // --- reads ---
  const get = raw.get;
  const list = raw.list;
  const listByStatus = raw.listByStatus;
  const listByAgentSession = raw.listByAgentSession;
  const countActive = raw.countActive;

  // --- mutations (orchestrated) ---
  const cancel = async (id: string) => {
    const existing = await raw.get(id);
    if (existing?.status === "queued") {
      const cancelled = await raw.cancelQueued(id);
      if (cancelled) {
        deps.eventBus.emit("sessions", "set", cancelled);
        if (cancelled.project_id) {
          deps.onSessionStatusChanged?.({
            id: cancelled.id,
            project_id: cancelled.project_id,
            status: cancelled.status,
            original_session_id: cancelled.original_session_id,
          });
        }
        return cancelled;
      }
    }

    const entry = store.get(id);
    entry?.process?.kill();

    const updated = await transitionStatus(id, "cancelled");
    if (updated) {
      entry?.eventStore.push({ op: "replace", path: "/status", value: "cancelled" });
    }

    return updated;
  };

  const emitStartedHook = (session: SessionRecord) => {
    if (!session.project_id) return;

    deps.onSessionStarted?.({
      id: session.id,
      project_id: session.project_id,
      status: session.status,
      original_session_id: session.original_session_id,
    });
  };

  const emitResumedHook = (session: SessionRecord) => {
    if (!session.project_id) return;

    deps.onSessionResumed?.({
      id: session.id,
      project_id: session.project_id,
      status: session.status,
      original_session_id: session.original_session_id,
    });
  };

  const create = async (input: Parameters<typeof raw.create>[0], options: CreateSessionOptions = {}) => {
    const session = await raw.create(input);
    deps.eventBus.emit("sessions", "set", session);
    if (options.emitStartedHook !== false) {
      emitStartedHook(session);
    }
    return session;
  };

  const createQueuedWithEntry = async (
    input: Parameters<typeof raw.createQueuedWithEntry>[0],
    options: CreateSessionOptions = {},
  ) => {
    const session = await raw.createQueuedWithEntry(input);
    deps.eventBus.emit("sessions", "set", session);
    if (options.emitStartedHook !== false) {
      emitStartedHook(session);
    }
    return session;
  };

  const queueExistingWithEntry = async (input: Parameters<typeof raw.queueExistingWithEntry>[0]) => {
    const updated = await raw.queueExistingWithEntry(input);
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

  const claimQueuedForDispatch = async (id: string) => {
    const updated = await raw.claimQueuedForDispatch(id);
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

  const recoverQueuedDispatchClaim = async (id: string) => {
    const updated = await raw.recoverQueuedDispatchClaim(id);
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

  const update = async (id: string, input: Parameters<typeof raw.update>[1]) => {
    const updated = await raw.update(id, input);
    if (updated) {
      deps.eventBus.emit("sessions", "set", updated);
    }
    return updated;
  };

  const archive = async (id: string) => {
    const existing = await raw.get(id);
    if (existing?.status === "queued") {
      const archived = await raw.archiveQueued(id);
      if (archived) {
        deps.eventBus.emit("sessions", "set", archived);
        return archived;
      }
    }

    const updated = await raw.archive(id);
    if (!updated) return null;

    deps.eventBus.emit("sessions", "set", updated);
    return updated;
  };

  const transitionStatus = async (id: string, status: SessionStatus, options: TransitionStatusOptions = {}) => {
    if (status === "queued") {
      throw new Error("Queued status is scheduler-owned and requires a queue entry");
    }

    const existing = releasesCapacity(status) ? await raw.get(id) : null;
    if (existing?.status === "queued") {
      await deps.sessionQueueEntriesService?.remove(id);
    }

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
    if (releasesCapacity(status) && options.drainCapacity !== false) {
      await deps.onCapacityAvailable?.();
    }
    return updated;
  };

  const resume = async (id: string, options: ResumeSessionOptions = {}) => {
    const updated = await raw.updateStatus(id, "in_progress");
    if (!updated) return null;

    deps.eventBus.emit("sessions", "set", updated);
    if (updated.project_id && options.emitResumedHook !== false) {
      emitResumedHook(updated);
    }
    return updated;
  };

  return {
    get,
    list,
    listByStatus,
    listByAgentSession,
    countActive,
    create,
    createQueuedWithEntry,
    queueExistingWithEntry,
    claimQueuedForDispatch,
    recoverQueuedDispatchClaim,
    update,
    transitionStatus,
    cancel,
    archive,
    resume,
    emitStartedHook,
    emitResumedHook,
    store,
  };
};
