import type { ApprovalRequest, ApprovalService, EventStore, SpawnedProcess } from "pstdio-agents";
import { createApprovalService, createEventStore } from "pstdio-agents";

type ActiveSession = {
  eventStore: EventStore & { close(): void };
  approvalService: ApprovalService;
  process: SpawnedProcess | null;
};

// In-memory registry of active sessions (EventStore + ApprovalService + process per session)
export const createSessionStore = () => {
  const sessions = new Map<string, ActiveSession>();

  const create = (sessionId: string, onApprovalRequest: (request: ApprovalRequest) => void) => {
    const existing = sessions.get(sessionId);
    if (existing) {
      existing.eventStore.close();
      existing.approvalService.dispose();
    }

    const eventStore = createEventStore();
    const approvalService = createApprovalService(onApprovalRequest);

    const entry: ActiveSession = { eventStore, approvalService, process: null };
    sessions.set(sessionId, entry);

    return entry;
  };

  const get = (sessionId: string) => sessions.get(sessionId) ?? null;

  const setProcess = (sessionId: string, process: SpawnedProcess) => {
    const entry = sessions.get(sessionId);
    if (entry) entry.process = process;
  };

  const remove = (sessionId: string) => {
    const entry = sessions.get(sessionId);
    if (!entry) return;
    entry.eventStore.close();
    entry.approvalService.dispose();
    sessions.delete(sessionId);
  };

  return { create, get, setProcess, remove };
};

export type SessionStore = ReturnType<typeof createSessionStore>;
