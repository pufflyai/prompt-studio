import { workbenchPages } from "@pstdio/sdk/extensions";
import type { ChatInputQuestionResponse, SessionMessage } from "@pstdio/ui/chat-ui";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench";
import type { SessionAttachment } from "pstdio-api-contracts";
import { createDashboardResource } from "@/shared/app/resources";
import type { HarnessParamValues } from "../components/harness-param-values";
import { resolveDashboardSessionViewForPlacement } from "../data/dashboard-sessions";
import { toSessionNotice } from "../data/session-notice";
import { rememberDashboardSessionResource } from "../state/session-selection";
import {
  createPendingFollowUpState,
  failPendingFollowUp,
  type PendingFollowUpState,
  updatePendingFollowUp,
} from "./session-chat-state";

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

export type MoveQueuedFollowUpMutation = {
  mutateAsync: (input: {
    sessionId: string;
    queuePosition: number;
    direction: "up" | "down";
  }) => Promise<{ ok: true; queuePosition: number }>;
};

export const moveQueuedFollowUpBySteps = async (input: {
  sessionId: string;
  queuePosition: number;
  direction: "up" | "down";
  steps: number;
  mutation: MoveQueuedFollowUpMutation;
  reconnect: () => void;
}) => {
  let currentPosition = input.queuePosition;

  try {
    for (let step = 0; step < input.steps; step += 1) {
      const result = await input.mutation.mutateAsync({
        sessionId: input.sessionId,
        queuePosition: currentPosition,
        direction: input.direction,
      });
      currentPosition = result.queuePosition;
    }
  } catch {
    return;
  } finally {
    input.reconnect();
  }
};

const createSessionTitle = (prompt: string) => prompt.slice(0, 100) || "Session";

// The user may have moved the panel to another session while the request was open.
const placementShowsDraft = (input: WorkbenchPanelRenderInput, draftKey: string) => {
  const placement = Object.values(input.workbench.layout.getLayout().regions)
    .flatMap((region) => region.widgets)
    .find((widget) => widget.widgetId === input.instance.instanceId);
  return Boolean(placement && resolveDashboardSessionViewForPlacement(placement).draftKey === draftKey);
};

export const openCreatedSessionFromDraft = (args: {
  input: WorkbenchPanelRenderInput;
  draftKey: string;
  sessionId: string;
  prompt: string;
  projectId: string;
}) => {
  if (!placementShowsDraft(args.input, args.draftKey)) return undefined;
  const title = createSessionTitle(args.prompt);
  const resource = createDashboardResource("session", args.sessionId, title, "MessageCircle", args.projectId);

  rememberDashboardSessionResource(args.input.workbench, resource);
  const identity = args.input.instance.placementIdentity;
  if (identity?.kind === "mode") {
    args.input.workbench.modePlacements.updatePlacement(identity, { resource, title });
    return identity;
  }
  if (identity?.kind === "page") {
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
  onSubmitted?: () => void;
  onQuestionResponseError?: () => void;
}) => {
  const pending = createPendingFollowUpState({
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
        if (input.questionResponse) input.onSubmitted?.();
        // Queued turns use their queue entry; accepted answers update the existing question.
        if (followUp?.status === "queued" || input.questionResponse) clearPendingFollowUp(input.sessionId, pending);
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
  onSubmitted?: () => void;
  onQuestionResponseError?: () => void;
  onSessionCreated?: (sessionId: string) => void;
}) => {
  if (!input.sessionId) return submitNewSessionMessage(input);
  return submitFollowUpMessage({ ...input, sessionId: input.sessionId });
};
