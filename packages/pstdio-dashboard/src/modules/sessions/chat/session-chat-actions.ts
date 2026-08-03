import type { ChatInputQuestionResponse, SessionMessage } from "@pstdio/ui/chat-ui";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench";
import type { SessionAttachment } from "pstdio-api-contracts";
import type { Dispatch, SetStateAction } from "react";
import { createDashboardResource } from "@/shared/app/resources";
import type { HarnessParamValues } from "../components/harness-param-values";
import { rememberDashboardSessionResource } from "../state/session-selection";
import {
  assignPendingFollowUpSession,
  createPendingFollowUpState,
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
      onError: () => void;
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
      onError: () => void;
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
}) => {
  const title = createSessionTitle(args.prompt);
  const resource = createDashboardResource("session", args.sessionId, title, "MessageCircle", args.projectId);

  rememberDashboardSessionResource(args.input.workbench, resource);

  return args.input.workbench.layout.openPanel(args.input.instance.panelId, {
    resource,
    title,
    strategy: { kind: "replace-panel", instanceId: args.input.instance.instanceId },
  });
};

const clearPendingFollowUpForCreatedSession = (
  current: PendingFollowUpState | null,
  pending: PendingFollowUpState,
  sessionId: string,
) => {
  if (!current || current.userMessageId !== pending.userMessageId) return current;
  return assignPendingFollowUpSession(current, sessionId);
};

const clearPendingFollowUpForFailedSession = (current: PendingFollowUpState | null, pending: PendingFollowUpState) => {
  if (!current || current.userMessageId !== pending.userMessageId) return current;
  return null;
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
  onSessionCreated?: (sessionId: string) => void;
}) => {
  if (!input.projectId || !input.agent) return;

  const pending = createPendingFollowUpState({
    prompt: input.text,
    messageCount: input.messages.length,
    pendingId: input.pendingId,
    attachments: input.attachments,
  });
  input.setPendingFollowUp(pending);

  input.createSession.mutate(
    {
      projectId: input.projectId,
      prompt: input.text,
      agent: input.agent,
      model: input.model,
      params: input.params,
      workspaceId: input.workspaceId,
      attachments: input.attachments,
    },
    {
      onSuccess: ({ sessionId, status }) => {
        input.onSubmitted?.();
        input.setPendingFollowUp((current) =>
          status === "queued" ? null : clearPendingFollowUpForCreatedSession(current, pending, sessionId),
        );
        input.onSessionCreated?.(sessionId);
      },
      onError: () => {
        input.setPendingFollowUp((current) => clearPendingFollowUpForFailedSession(current, pending));
      },
    },
  );
};

const submitFollowUpMessage = (input: {
  sessionId: string;
  agent: string | null;
  model: string | undefined;
  params?: HarnessParamValues;
  text: string;
  attachments?: SessionAttachment[];
  messages: SessionMessage[];
  pendingId: string;
  questionResponse?: ChatInputQuestionResponse;
  setPendingFollowUp: Dispatch<SetStateAction<PendingFollowUpState | null>>;
  followUp: FollowUpMutation;
  reconnect: () => void;
  onSubmitted?: () => void;
  onQuestionResponseError?: () => void;
}) => {
  input.setPendingFollowUp(
    input.questionResponse
      ? null
      : createPendingFollowUpState({
          prompt: input.text,
          messageCount: input.messages.length,
          pendingId: input.pendingId,
          sessionId: input.sessionId,
          attachments: input.attachments,
        }),
  );

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
      onSuccess: () => {
        input.onSubmitted?.();
        input.reconnect();
      },
      onError: () => {
        input.setPendingFollowUp(null);
        input.onQuestionResponseError?.();
      },
    },
  );
};

export const submitSessionMessage = (input: {
  sessionId: string | null;
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
  onSessionCreated?: (sessionId: string) => void;
}) => {
  const pendingId = `pending-${input.pendingIdRef.current}`;
  input.pendingIdRef.current += 1;

  if (!input.sessionId) {
    submitNewSessionMessage({
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
    return;
  }

  submitFollowUpMessage({
    sessionId: input.sessionId,
    agent: input.agent,
    model: input.model,
    params: input.params,
    text: input.text,
    attachments: input.attachments,
    questionResponse: input.questionResponse,
    messages: input.messages,
    pendingId,
    setPendingFollowUp: input.setPendingFollowUp,
    followUp: input.followUp,
    reconnect: input.reconnect,
    onSubmitted: input.onSubmitted,
    onQuestionResponseError: input.onQuestionResponseError,
  });
};
