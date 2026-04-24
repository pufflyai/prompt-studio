import type { ChatInputQuestionResponse, SessionMessage } from "@pstdio/ui/chat-ui";
import type { Dispatch, SetStateAction } from "react";
import { apiRequest } from "@/lib/api";
import {
  assignPendingFollowUpSession,
  createPendingFollowUpState,
  type PendingFollowUpState,
} from "./session-chat-state";

export type CreateSessionMutation = {
  mutate: (
    input: { projectId: string; prompt: string; agent: string; model: string | undefined; workspaceId?: string },
    options: {
      onSuccess: (result: { sessionId: string }) => void;
      onError: () => void;
    },
  ) => void;
};

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
      onSuccess: () => void;
      onError: () => void;
    },
  ) => void;
};

const clearPendingFollowUpForCreatedSession = (
  current: PendingFollowUpState | null,
  pending: PendingFollowUpState,
  sessionId: string,
) => {
  if (!current || current.userMessageId !== pending.userMessageId) {
    return current;
  }

  return assignPendingFollowUpSession(current, sessionId);
};

const clearPendingFollowUpForFailedSession = (current: PendingFollowUpState | null, pending: PendingFollowUpState) => {
  if (!current || current.userMessageId !== pending.userMessageId) {
    return current;
  }

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
  clearSessionDraft: (sessionId: string | null) => void;
  setChatDraft: Dispatch<SetStateAction<string>>;
  setPendingFollowUp: Dispatch<SetStateAction<PendingFollowUpState | null>>;
  createSession: CreateSessionMutation;
  onSessionCreated?: (sessionId: string) => void;
}) => {
  if (!input.projectId || !input.agent) {
    return;
  }

  input.clearSessionDraft(null);
  input.setChatDraft("");

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
      onSuccess: ({ sessionId }) => {
        input.setPendingFollowUp((current) => clearPendingFollowUpForCreatedSession(current, pending, sessionId));
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
  clearSessionDraft: (sessionId: string | null) => void;
  setChatDraft: Dispatch<SetStateAction<string>>;
  setPendingFollowUp: Dispatch<SetStateAction<PendingFollowUpState | null>>;
  followUp: FollowUpMutation;
  reconnect: () => void;
}) => {
  input.clearSessionDraft(input.sessionId);
  input.setChatDraft("");
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
      onSuccess: input.reconnect,
      onError: () => input.setPendingFollowUp(null),
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
  clearSessionDraft: (sessionId: string | null) => void;
  setChatDraft: Dispatch<SetStateAction<string>>;
  setPendingFollowUp: Dispatch<SetStateAction<PendingFollowUpState | null>>;
  createSession: CreateSessionMutation;
  followUp: FollowUpMutation;
  reconnect: () => void;
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
      clearSessionDraft: input.clearSessionDraft,
      setChatDraft: input.setChatDraft,
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
    clearSessionDraft: input.clearSessionDraft,
    setChatDraft: input.setChatDraft,
    setPendingFollowUp: input.setPendingFollowUp,
    followUp: input.followUp,
    reconnect: input.reconnect,
  });
};

export const submitApprovalDecision = (input: {
  sessionId: string | null;
  approvalRequestId: string | undefined;
  decision: "approve" | "deny";
}) => {
  if (!input.sessionId || !input.approvalRequestId) {
    return;
  }

  apiRequest(`/v1/sessions/${input.sessionId}/approve`, {
    method: "POST",
    body: { id: input.approvalRequestId, decision: input.decision },
  });
};
