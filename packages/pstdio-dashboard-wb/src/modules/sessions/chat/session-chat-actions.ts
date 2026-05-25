import type { ChatInputQuestionResponse, SessionMessage } from "@pstdio/ui/chat-ui";
import type { WorkbenchWidgetRenderInput } from "pstdio-workbench/core";
import type { Dispatch, SetStateAction } from "react";
import { createDashboardResource } from "@/shared/app/resources";
import { rememberDashboardSessionResource } from "../state/session-selection";
import {
  assignPendingFollowUpSession,
  createPendingFollowUpState,
  type PendingFollowUpState,
} from "./session-chat-state";

export type CreateSessionMutation = {
  mutate: (
    input: { projectId: string; prompt: string; agent: string; model: string | undefined; workspaceId?: string },
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
      questionResponse?: ChatInputQuestionResponse;
    },
    options: {
      onSuccess: (result: { status: string; followUp?: FollowUpDecision }) => void;
      onError: () => void;
    },
  ) => void;
};

const createSessionTitle = (prompt: string) => prompt.slice(0, 100) || "Session";

export const openCreatedSessionFromDraft = (args: {
  input: WorkbenchWidgetRenderInput;
  sessionId: string;
  prompt: string;
  projectId: string;
}) => {
  const title = createSessionTitle(args.prompt);
  const resource = createDashboardResource("session", args.sessionId, title, "MessageCircle", args.projectId);

  rememberDashboardSessionResource(args.input.workbench, resource);

  return args.input.workbench.layout.openWidget(args.input.placement.contributionId, {
    resource,
    title,
    replaceActive: true,
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
  workspaceId?: string;
  text: string;
  messages: SessionMessage[];
  pendingId: string;
  setPendingFollowUp: Dispatch<SetStateAction<PendingFollowUpState | null>>;
  createSession: CreateSessionMutation;
  onSessionCreated?: (sessionId: string) => void;
}) => {
  if (!input.projectId || !input.agent) return;

  const pending = createPendingFollowUpState({
    prompt: input.text,
    messageCount: input.messages.length,
    pendingId: input.pendingId,
  });
  input.setPendingFollowUp(pending);

  input.createSession.mutate(
    {
      projectId: input.projectId,
      prompt: input.text,
      agent: input.agent,
      model: input.model,
      workspaceId: input.workspaceId,
    },
    {
      onSuccess: ({ sessionId, status }) => {
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
  text: string;
  messages: SessionMessage[];
  pendingId: string;
  questionResponse?: ChatInputQuestionResponse;
  setPendingFollowUp: Dispatch<SetStateAction<PendingFollowUpState | null>>;
  followUp: FollowUpMutation;
  reconnect: () => void;
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
        }),
  );

  input.followUp.mutate(
    {
      sessionId: input.sessionId,
      prompt: input.text,
      agent: input.agent ?? undefined,
      model: input.model,
      questionResponse: input.questionResponse,
    },
    {
      onSuccess: () => {
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
  workspaceId?: string;
  text: string;
  questionResponse?: ChatInputQuestionResponse;
  messages: SessionMessage[];
  pendingIdRef: { current: number };
  setPendingFollowUp: Dispatch<SetStateAction<PendingFollowUpState | null>>;
  createSession: CreateSessionMutation;
  followUp: FollowUpMutation;
  reconnect: () => void;
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
      workspaceId: input.workspaceId,
      text: input.text,
      messages: input.messages,
      pendingId,
      setPendingFollowUp: input.setPendingFollowUp,
      createSession: input.createSession,
      onSessionCreated: input.onSessionCreated,
    });
    return;
  }

  submitFollowUpMessage({
    sessionId: input.sessionId,
    agent: input.agent,
    model: input.model,
    text: input.text,
    questionResponse: input.questionResponse,
    messages: input.messages,
    pendingId,
    setPendingFollowUp: input.setPendingFollowUp,
    followUp: input.followUp,
    reconnect: input.reconnect,
    onQuestionResponseError: input.onQuestionResponseError,
  });
};
