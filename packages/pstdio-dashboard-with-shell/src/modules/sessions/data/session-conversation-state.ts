import type { SessionMessage } from "@pstdio/ui/chat-ui";

export interface ApprovalRequest {
  id: string;
  toolName: string;
  toolInput: unknown;
  toolUseId: string;
}

export interface SessionConversationState {
  sessionId: string | null;
  messages: SessionMessage[];
  isLoadingMessages: boolean;
  isStreaming: boolean;
  approvalRequest: ApprovalRequest | null;
}

export const getInitialSessionConversationState = (sessionId: string | null, cachedMessages: SessionMessage[]) => {
  const hasCachedMessages = cachedMessages.length > 0;
  const isLoadingMessages = Boolean(sessionId) && !hasCachedMessages;

  return {
    sessionId,
    messages: cachedMessages,
    isStreaming: isLoadingMessages,
    isLoadingMessages,
    approvalRequest: null,
  };
};

export const resolveSessionConversationSnapshot = (
  requestedSessionId: string | null,
  state: SessionConversationState,
) => {
  if (!requestedSessionId) {
    return {
      messages: [],
      isLoadingMessages: false,
      isStreaming: false,
      approvalRequest: null,
    };
  }

  if (state.sessionId !== requestedSessionId) {
    return {
      messages: [],
      isLoadingMessages: true,
      isStreaming: false,
      approvalRequest: null,
    };
  }

  return {
    messages: state.messages,
    isLoadingMessages: state.isLoadingMessages,
    isStreaming: state.isStreaming,
    approvalRequest: state.approvalRequest,
  };
};
