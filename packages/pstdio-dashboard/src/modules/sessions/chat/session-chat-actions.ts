import type { ChatInputQuestionResponse, SessionMessage } from "@pstdio/ui/chat-ui";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench";
import type { SessionAttachment } from "pstdio-api-contracts";
import type { Dispatch, SetStateAction } from "react";
import { createDashboardResource } from "@/shared/app/resources";
import type { HarnessParamValues } from "../components/harness-param-values";
import { toSessionNotice } from "../data/session-notice";
import { rememberDashboardSessionResource } from "../state/session-selection";
import {
  assignPendingFollowUpSession,
  createPendingFollowUpState,
  failPendingFollowUp,
  handOffPendingFollowUp,
  type PendingFollowUpState,
} from "./session-chat-state";

export type CreateSessionMutation = {
  mutate: (
    input: {
      projectId: string;
      prompt: string;
      agent: string;
      model: string | undefined;
      params?: HarnessParamValues;
      workspaceId?: string;
      attachments?: SessionAttachment[];
    },
    options: {
      onSuccess: (result: { sessionId: string; status: string }) => void;
      onError: (error?: Error) => void;
    },
  ) => void;
};

export type FollowUpDecision = { status: "dispatched" } | { status: "queued"; queue_position: number };

export type FollowUpMutation = {
  mutate: (
    input: {
      sessionId: string;
      prompt: string;
      agent?: string;
      model?: string;
      params?: HarnessParamValues;
      questionResponse?: ChatInputQuestionResponse;
      attachments?: SessionAttachment[];
    },
    options: {
      onSuccess: (result: { status: string; followUp?: FollowUpDecision }) => void;
      onError: (error?: Error) => void;
    },
  ) => void;
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

export const openCreatedSessionFromDraft = (args: {
  input: WorkbenchPanelRenderInput;
  sessionId: string;
  prompt: string;
  projectId: string;
  pending?: PendingFollowUpState;
}) => {
  const title = createSessionTitle(args.prompt);
  const resource = createDashboardResource("session", args.sessionId, title, "MessageCircle", args.projectId);

  rememberDashboardSessionResource(args.input.workbench, resource);
  const identity = args.input.instance.placementIdentity;
  if (identity?.kind === "mode") {
    args.input.workbench.modePlacements.updatePlacement(identity, { resource, title });
    return identity;
  }
  if (identity?.kind === "page") {
    // The session page mounts a new chat panel; it starts from the draft's first message.
    if (args.pending) handOffPendingFollowUp(args.pending);
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

const clearPendingFollowUpForCreatedSession = (
  current: PendingFollowUpState | null,
  pending: PendingFollowUpState,
  sessionId: string,
) => {
  if (!current || current.userMessageId !== pending.userMessageId) return current;
  return assignPendingFollowUpSession(current, sessionId);
};

const submitNewSessionMessage = (input: {
  projectId: string | undefined;
  agent: string | null;
  model: string | undefined;
  params?: HarnessParamValues;
  workspaceId?: string;
  text: string;
  attachments?: SessionAttachment[];
  messages: SessionMessage[];
  pendingId: string;
  setPendingFollowUp: Dispatch<SetStateAction<PendingFollowUpState | null>>;
  createSession: CreateSessionMutation;
  onSubmitted?: () => void;
  onSessionCreated?: (sessionId: string, pending?: PendingFollowUpState) => void;
}) => {
  if (!input.projectId || !input.agent)
    return Promise.reject(new Error("Select a project and an agent before sending."));
  const projectId = input.projectId;
  const agent = input.agent;

  const pending = createPendingFollowUpState({
    prompt: input.text,
    messageCount: input.messages.length,
    pendingId: input.pendingId,
    attachments: input.attachments,
  });
  input.setPendingFollowUp(pending);
  input.onSubmitted?.();

  return new Promise<void>((resolve) =>
    input.createSession.mutate(
      {
        projectId,
        prompt: input.text,
        agent,
        model: input.model,
        params: input.params,
        workspaceId: input.workspaceId,
        attachments: input.attachments,
      },
      {
        onSuccess: ({ sessionId, status }) => {
          input.setPendingFollowUp((current) =>
            status === "queued" ? null : clearPendingFollowUpForCreatedSession(current, pending, sessionId),
          );
          // A queued session shows its prompt in the queued list, so only a started one hands it off.
          input.onSessionCreated?.(
            sessionId,
            status === "queued" ? undefined : assignPendingFollowUpSession(pending, sessionId),
          );
          resolve();
        },
        // The conversation keeps ownership of the failed message.
        onError: (error) => {
          const failure = toSessionNotice(error ?? new Error("Could not create the session."));
          input.setPendingFollowUp((current) => failPendingFollowUp(current, pending, failure));
          resolve();
        },
      },
    ),
  );
};

const submitFollowUpMessage = (input: {
  sessionId: string;
  lastRequestStarted?: string | null;
  messages: SessionMessage[];
  pendingId: string;
  setPendingFollowUp: Dispatch<SetStateAction<PendingFollowUpState | null>>;
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
    pendingId: input.pendingId,
    sessionId: input.sessionId,
    previousRunStarted: input.lastRequestStarted,
    attachments: input.attachments,
    questionResponse: input.questionResponse,
  });
  input.setPendingFollowUp(pending);
  if (!input.questionResponse) input.onSubmitted?.();

  return new Promise<void>((resolve, reject) =>
    input.followUp.mutate(
      {
        sessionId: input.sessionId,
        prompt: input.text,
        agent: input.agent ?? undefined,
        model: input.model,
        params: input.params,
        questionResponse: input.questionResponse,
        attachments: input.attachments,
      },
      {
        onSuccess: ({ followUp }) => {
          if (input.questionResponse) input.onSubmitted?.();
          // Queued turns use their queue entry; accepted answers update the existing question.
          if (followUp?.status === "queued" || input.questionResponse)
            input.setPendingFollowUp((current) => (current?.userMessageId === pending.userMessageId ? null : current));
          input.reconnect();
          resolve();
        },
        // The conversation keeps ownership of the failed message.
        onError: (error) => {
          input.onQuestionResponseError?.();
          const failure = toSessionNotice(error ?? new Error("Could not send the follow-up."));
          input.setPendingFollowUp((current) => failPendingFollowUp(current, pending, failure));
          if (input.questionResponse) {
            reject(error ?? new Error("Could not send the answer."));
            return;
          }
          resolve();
        },
      },
    ),
  );
};

export const submitSessionMessage = (input: {
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
  pendingIdRef: { current: number };
  setPendingFollowUp: Dispatch<SetStateAction<PendingFollowUpState | null>>;
  createSession: CreateSessionMutation;
  followUp: FollowUpMutation;
  reconnect: () => void;
  onSubmitted?: () => void;
  onQuestionResponseError?: () => void;
  onSessionCreated?: (sessionId: string, pending?: PendingFollowUpState) => void;
}) => {
  const pendingId = `pending-${input.pendingIdRef.current}`;
  input.pendingIdRef.current += 1;

  if (!input.sessionId) {
    return submitNewSessionMessage({
      projectId: input.projectId,
      agent: input.agent,
      model: input.model,
      params: input.params,
      workspaceId: input.workspaceId,
      text: input.text,
      attachments: input.attachments,
      messages: input.messages,
      pendingId,
      setPendingFollowUp: input.setPendingFollowUp,
      createSession: input.createSession,
      onSubmitted: input.onSubmitted,
      onSessionCreated: input.onSessionCreated,
    });
  }

  return submitFollowUpMessage({
    sessionId: input.sessionId,
    lastRequestStarted: input.lastRequestStarted,
    messages: input.messages,
    pendingId,
    setPendingFollowUp: input.setPendingFollowUp,
    agent: input.agent,
    model: input.model,
    params: input.params,
    text: input.text,
    attachments: input.attachments,
    questionResponse: input.questionResponse,
    followUp: input.followUp,
    reconnect: input.reconnect,
    onSubmitted: input.onSubmitted,
    onQuestionResponseError: input.onQuestionResponseError,
  });
};

import { workbenchPages } from "@pstdio/sdk/extensions";
