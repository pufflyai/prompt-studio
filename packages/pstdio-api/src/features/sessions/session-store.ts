import type { ApprovalRequest, ApprovalService, EventStore, HarnessSession } from "pstdio-api-contracts";
import { createApprovalService, createEventStore } from "pstdio-api-runtime-host";

type ActiveSession = {
  eventStore: EventStore & { close(): void };
  approvalService: ApprovalService;
  session: HarnessSession | null;
  cancellationRequested: boolean;
  submittedAttachmentFileIds: Set<string>;
};

// In-memory registry of active sessions (EventStore + ApprovalService + harness session per session)
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

    const entry: ActiveSession = {
      eventStore,
      approvalService,
      session: null,
      cancellationRequested: false,
      submittedAttachmentFileIds: new Set(),
    };
    sessions.set(sessionId, entry);

    return entry;
  };

  const get = (sessionId: string) => sessions.get(sessionId) ?? null;
  const setSession = (sessionId: string, session: HarnessSession) => {
    const entry = sessions.get(sessionId);
    if (!entry) return false;
    entry.session = session;
    return !entry.cancellationRequested;
  };
  const markCancellationRequested = (sessionId: string) => {
    const entry = sessions.get(sessionId);
    if (!entry) return null;
    entry.cancellationRequested = true;
    return entry;
  };
  const remove = (sessionId: string) => {
    const entry = sessions.get(sessionId);
    if (!entry) return;
    entry.eventStore.close();
    entry.approvalService.dispose();
    sessions.delete(sessionId);
  };

  return { create, get, setSession, markCancellationRequested, remove };
};
