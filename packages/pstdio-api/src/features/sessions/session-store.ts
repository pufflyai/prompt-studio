import type {
  ApprovalRequest,
  EventStore,
  HarnessSession,
  QuestionService,
  SessionMessage,
} from "pstdio-api-contracts";
import { createApprovalService, createEventStore, createQuestionService } from "pstdio-api-runtime-host";
import { createSessionConversation, type SessionConversation } from "./session-conversation";

/** What the host does when a per-session channel signals. The store has no session service of its own. */
export type SessionChannelHooks = {
  onApprovalRequest: (request: ApprovalRequest) => void;
  onQuestionAsked: () => unknown;
  onQuestionAnswered: () => unknown;
};

export type ActiveSession = {
  eventStore: EventStore & { close(): void };
  approvalService: ReturnType<typeof createApprovalService>;
  questionService: QuestionService;
  session: HarnessSession | null;
  cancellationRequested: boolean;
  submittedAttachmentFileIds: Set<string>;
  conversationReady: Promise<SessionConversation>;
  controlInvocations: Set<{ done: Promise<void>; abort: AbortController }>;
  executionSettings?: { model: string | null; params: Record<string, string | boolean> };
  checkpointPromise?: Promise<SessionMessage[] | null>;
};

export const cancelSessionControls = (entry: ActiveSession | null | undefined) => {
  if (!entry) return;
  for (const control of entry.controlInvocations) control.abort.abort();
  entry.approvalService.dispose();
  entry.questionService.dispose();
};

// In-memory registry of active sessions (EventStore + channels + harness session per session)
export const createSessionStore = () => {
  const sessions = new Map<string, ActiveSession>();

  const create = (
    sessionId: string,
    hooks: SessionChannelHooks,
    initialize?: (previous: ActiveSession | undefined) => Promise<SessionMessage[]>,
  ) => {
    const existing = sessions.get(sessionId);
    if (existing && !initialize) {
      existing.eventStore.close();
      existing.approvalService.dispose();
      existing.questionService.dispose();
    }

    const eventStore = createEventStore();
    const approvalService = createApprovalService(hooks.onApprovalRequest);
    const questionService = createQuestionService({ onAsk: hooks.onQuestionAsked, onAnswer: hooks.onQuestionAnswered });
    const ready = Promise.withResolvers<SessionConversation>();

    const entry: ActiveSession = {
      eventStore,
      approvalService,
      questionService,
      session: null,
      cancellationRequested: false,
      submittedAttachmentFileIds: new Set(),
      conversationReady: ready.promise,
      controlInvocations: new Set(),
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
          questionService.dispose();
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
    cancelSessionControls(entry);
    return entry;
  };
  const remove = (sessionId: string, expected = sessions.get(sessionId)) => {
    const entry = sessions.get(sessionId);
    if (!entry || entry !== expected) return;
    entry.eventStore.close();
    void entry.conversationReady.then((conversation) => conversation.close()).catch(() => undefined);
    entry.approvalService.dispose();
    entry.questionService.dispose();
    sessions.delete(sessionId);
  };

  return { create, get, setSession, markCancellationRequested, remove };
};
