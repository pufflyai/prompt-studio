import type { PendingQueuedFollowUpsResponse } from "@pstdio/sdk/api";
import { workbenchPages } from "@pstdio/sdk/extensions";
import type { ChatInputQuestionResponse, SessionMessage } from "@pstdio/ui/chat-ui";
import type { HarnessParamValues } from "@pstdio/ui/param-editor";
import type { SessionAttachment } from "pstdio-api-contracts";
import { createDashboardSessionResource } from "@/shared/app/resources";
import { toSessionNotice } from "../data/session-notice";
import { rememberDashboardSessionResource } from "../state/session-selection";
import {
  createPendingFollowUpState,
  failPendingFollowUp,
  type PendingFollowUpState,
  updatePendingFollowUp,
} from "./session-chat-state";
import { type SessionViewContext, sessionViewShowsDraft } from "./session-view-context";

// Post-send work runs on the request promise. Callbacks passed to TanStack's `mutate()` are
// skipped once the chat panel unmounts, which would leave the message without an owner.
export type CreateSessionMutation = {
  mutateAsync: (input: {
    projectId: string;
    prompt: string;
    agent: string;
    model: string | undefined;
    params?: HarnessParamValues;
    workspaceId?: string;
    attachments?: SessionAttachment[];
  }) => Promise<{ sessionId: string; status: string }>;
};

export type FollowUpDecision = { status: "dispatched" } | { status: "queued"; queue_position: number };

export type FollowUpMutation = {
  mutateAsync: (input: {
    sessionId: string;
    prompt: string;
    agent?: string;
    model?: string;
    params?: HarnessParamValues;
    questionResponse?: ChatInputQuestionResponse;
    attachments?: SessionAttachment[];
  }) => Promise<{ status: string; followUp?: FollowUpDecision }>;
};

const createSessionTitle = (prompt: string) => prompt.slice(0, 100) || "Session";

export const openCreatedSessionFromDraft = (args: {
  input: SessionViewContext;
  draftKey: string;
  sessionId: string;
  prompt: string;
  projectId: string;
}) => {
  if (!sessionViewShowsDraft(args.input, args.draftKey)) return undefined;
  const title = createSessionTitle(args.prompt);
  const resource = createDashboardSessionResource(args.sessionId, title, args.projectId);

  rememberDashboardSessionResource(args.input.workbench, resource);
  const identity = args.input.owner.kind === "panel" ? args.input.owner.instance.placementIdentity : undefined;
  if (args.input.owner.kind === "panel" && identity?.kind === "mode") {
    args.input.workbench.modePlacements.updatePlacement(identity, { resource, title });
    args.input.workbench.layout.activatePanel(args.input.owner.instance.instanceId);
    return identity;
  }
  if (args.input.owner.kind === "page" || identity?.kind === "page") {
    const result = args.input.workbench.pageLocations.navigate({
      kind: "page",
      page: workbenchPages.session,
      resource,
    });
    if (!result.ok) throw new Error(result.diagnostic.message);
    return identity;
  }
  throw new Error("A session draft must be opened through an owned placement.");
};

// Ids only need to be unique among the messages a conversation shows at once.
let nextPendingId = 0;

// Only the submission that finished leaves; a newer submission keeps its own state.
const clearPendingFollowUp = (conversationKey: string, pending: PendingFollowUpState) =>
  updatePendingFollowUp(conversationKey, (current) =>
    current?.userMessageId === pending.userMessageId ? null : current,
  );

const submitNewSessionMessage = (input: {
  conversationKey: string;
  projectId: string | undefined;
  agent: string | null;
  model: string | undefined;
  params?: HarnessParamValues;
  workspaceId?: string;
  text: string;
  attachments?: SessionAttachment[];
  messages: SessionMessage[];
  createSession: CreateSessionMutation;
  onSubmitted?: () => void;
  onSessionCreated?: (sessionId: string) => void;
}) => {
  if (!input.projectId || !input.agent)
    return Promise.reject(new Error("Select a project and an agent before sending."));

  const pending = createPendingFollowUpState({
    prompt: input.text,
    messageCount: input.messages.length,
    pendingId: `pending-${nextPendingId++}`,
    attachments: input.attachments,
  });
  updatePendingFollowUp(input.conversationKey, pending);
  input.onSubmitted?.();

  return input.createSession
    .mutateAsync({
      projectId: input.projectId,
      prompt: input.text,
      agent: input.agent,
      model: input.model,
      params: input.params,
      workspaceId: input.workspaceId,
      attachments: input.attachments,
    })
    .then(
      ({ sessionId, status }) => {
        clearPendingFollowUp(input.conversationKey, pending);
        // The created session owns its first message until its conversation includes it. A queued
        // session shows the prompt in its queued list instead.
        if (status !== "queued") updatePendingFollowUp(sessionId, pending);
        input.onSessionCreated?.(sessionId);
      },
      // The conversation keeps ownership of the failed message.
      (error: Error | undefined) => {
        const failure = toSessionNotice(error ?? new Error("Could not create the session."));
        updatePendingFollowUp(input.conversationKey, (current) => failPendingFollowUp(current, pending, failure));
      },
    );
};

const submitFollowUpMessage = (input: {
  sessionId: string;
  sessionStatus?: string;
  lastRequestStarted?: string | null;
  messages: SessionMessage[];
  agent: string | null;
  model: string | undefined;
  params?: HarnessParamValues;
  text: string;
  attachments?: SessionAttachment[];
  questionResponse?: ChatInputQuestionResponse;
  followUp: FollowUpMutation;
  reconnect: () => void;
  refreshQueue: () => Promise<PendingQueuedFollowUpsResponse | undefined>;
  onSubmitted?: () => void;
  onQuestionResponseError?: () => void;
}) => {
  const pending = createPendingFollowUpState({
    destination:
      !input.questionResponse && ["in_progress", "awaiting_input", "queued"].includes(input.sessionStatus ?? "")
        ? "queue"
        : "conversation",
    prompt: input.text,
    messageCount: input.messages.length,
    pendingId: `pending-${nextPendingId++}`,
    previousRunStarted: input.lastRequestStarted,
    attachments: input.attachments,
    questionResponse: input.questionResponse,
  });
  updatePendingFollowUp(input.sessionId, pending);
  if (!input.questionResponse) input.onSubmitted?.();

  return input.followUp
    .mutateAsync({
      sessionId: input.sessionId,
      prompt: input.text,
      agent: input.agent ?? undefined,
      model: input.model,
      params: input.params,
      questionResponse: input.questionResponse,
      attachments: input.attachments,
    })
    .then(
      ({ followUp }) => {
        // Accepted answers update the existing question.
        if (input.questionResponse) {
          input.onSubmitted?.();
          clearPendingFollowUp(input.sessionId, pending);
          input.reconnect();
          return;
        }
        // Only the queue changed, so the live stream stays. The message stays until the queue list shows it.
        if (followUp?.status === "queued") {
          const queuePosition = followUp.queue_position;
          updatePendingFollowUp(input.sessionId, (current) =>
            current?.userMessageId === pending.userMessageId
              ? { ...current, destination: "queue", queuePosition }
              : current,
          );
          // A queue read started now is current. Without the request, the message already left the queue.
          void input.refreshQueue().then((queue) => {
            if (queue && !queue.requests.some((request) => request.queuePosition === queuePosition))
              clearPendingFollowUp(input.sessionId, pending);
          });
          return;
        }
        updatePendingFollowUp(input.sessionId, (current) =>
          current?.userMessageId === pending.userMessageId ? { ...current, destination: "conversation" } : current,
        );
        input.reconnect();
      },
      // The conversation keeps ownership of the failed message.
      (error: Error | undefined) => {
        input.onQuestionResponseError?.();
        const failure = toSessionNotice(error ?? new Error("Could not send the follow-up."));
        updatePendingFollowUp(input.sessionId, (current) => failPendingFollowUp(current, pending, failure));
        if (input.questionResponse) throw error ?? new Error("Could not send the answer.");
      },
    );
};

export const submitSessionMessage = (input: {
  /** The conversation that owns the message: the session id, or the draft key of a new session. */
  conversationKey: string;
  sessionId: string | null;
  sessionStatus?: string;
  lastRequestStarted?: string | null;
  projectId: string | undefined;
  agent: string | null;
  model: string | undefined;
  params?: HarnessParamValues;
  workspaceId?: string;
  text: string;
  attachments?: SessionAttachment[];
  questionResponse?: ChatInputQuestionResponse;
  messages: SessionMessage[];
  createSession: CreateSessionMutation;
  followUp: FollowUpMutation;
  reconnect: () => void;
  refreshQueue: () => Promise<PendingQueuedFollowUpsResponse | undefined>;
  onSubmitted?: () => void;
  onQuestionResponseError?: () => void;
  onSessionCreated?: (sessionId: string) => void;
}) => {
  if (!input.sessionId) return submitNewSessionMessage(input);
  return submitFollowUpMessage({ ...input, sessionId: input.sessionId });
};
