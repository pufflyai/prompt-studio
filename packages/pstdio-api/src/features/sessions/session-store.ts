import type {
  ApprovalRequest,
  ApprovalService,
  EventStore,
  HarnessSession,
  SessionMessage,
} from "pstdio-api-contracts";
import { createApprovalService, createEventStore } from "pstdio-api-runtime-host";
import { createSessionConversation, type SessionConversation } from "./session-conversation";

export type ActiveSession = {
  eventStore: EventStore & { close(): void };
  approvalService: ApprovalService;
  session: HarnessSession | null;
  cancellationRequested: boolean;
  submittedAttachmentFileIds: Set<string>;
  conversationReady: Promise<SessionConversation>;
  checkpointPromise?: Promise<SessionMessage[] | null>;
};

// In-memory registry of active sessions (EventStore + ApprovalService + harness session per session)
export const createSessionStore = () => {
  const sessions = new Map<string, ActiveSession>();

  const create = (
    sessionId: string,
    onApprovalRequest: (request: ApprovalRequest) => void,
    initialize?: (previous: ActiveSession | undefined) => Promise<SessionMessage[]>,
  ) => {
    const existing = sessions.get(sessionId);
    if (existing && !initialize) {
      existing.eventStore.close();
      existing.approvalService.dispose();
    }

    const eventStore = createEventStore();
    const approvalService = createApprovalService(onApprovalRequest);
    const ready = Promise.withResolvers<SessionConversation>();

    const entry: ActiveSession = {
      eventStore,
      approvalService,
      session: null,
      cancellationRequested: false,
      submittedAttachmentFileIds: new Set(),
      conversationReady: ready.promise,
    };
    sessions.set(sessionId, entry);
    if (initialize) {
      void Promise.resolve()
        .then(() => initialize(existing))
        .then((messages) => {
          if (sessions.get(sessionId) !== entry || entry.cancellationRequested)
            throw new DOMException("Session was cancelled", "AbortError");
          ready.resolve(createSessionConversation(eventStore, messages));
        })
        .catch((error) => {
          if (sessions.get(sessionId) === entry) {
            if (existing) sessions.set(sessionId, existing);
            else sessions.delete(sessionId);
          }
          eventStore.close();
          approvalService.dispose();
          ready.reject(error);
        });
    } else ready.resolve(createSessionConversation(eventStore));
    // Initialization also has readers that arrive after a failed launch.
    void ready.promise.catch(() => undefined);

    return entry;
  };

  const get = (sessionId: string) => sessions.get(sessionId) ?? null;
  const setSession = (sessionId: string, session: HarnessSession, expected = sessions.get(sessionId)) => {
    const entry = sessions.get(sessionId);
    if (!entry || entry !== expected) return false;
    entry.session = session;
    return !entry.cancellationRequested;
  };
  const markCancellationRequested = (sessionId: string) => {
    const entry = sessions.get(sessionId);
    if (!entry) return null;
    entry.cancellationRequested = true;
    return entry;
  };
  const remove = (sessionId: string, expected = sessions.get(sessionId)) => {
    const entry = sessions.get(sessionId);
    if (!entry || entry !== expected) return;
    entry.eventStore.close();
    void entry.conversationReady.then((conversation) => conversation.close()).catch(() => undefined);
    entry.approvalService.dispose();
    sessions.delete(sessionId);
  };

  return { create, get, setSession, markCancellationRequested, remove };
};
