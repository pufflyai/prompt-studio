import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { useEffect, useRef, useState } from "react";

import { getApiClient } from "@/lib/api";
import { fetchSessionConversationMessages, resolveStreamEndMessages } from "./session-conversation-hydration";
import {
  applyMessagePatch,
  getCachedSessionEntry,
  type JsonPatch,
  updateCachedSessionEntry,
} from "./session-stream-cache";
import { getSessionStreamReconnectDelayMs, resolveRecoveredStreamMessages } from "./session-stream-recovery";

export {
  applyMessagePatch,
  clearSessionStreamCache,
  getCachedSessionEntry,
  updateCachedSessionEntry,
} from "./session-stream-cache";

interface ApprovalRequest {
  id: string;
  toolName: string;
  toolInput: unknown;
  toolUseId: string;
}

interface SessionStreamState {
  messages: SessionMessage[];
  isStreaming: boolean;
  isLoadingMessages: boolean;
  approvalRequest: ApprovalRequest | null;
}

export const getInitialSessionStreamState = (sessionId: string | null, cachedMessages: SessionMessage[]) => {
  const hasCachedMessages = cachedMessages.length > 0;
  const isLoadingMessages = Boolean(sessionId) && !hasCachedMessages;

  return {
    messages: cachedMessages,
    isStreaming: isLoadingMessages,
    isLoadingMessages,
    approvalRequest: null,
  };
};

export const useSessionStream = (sessionId: string | null) => {
  const [state, setState] = useState<SessionStreamState>({
    messages: [],
    isStreaming: false,
    isLoadingMessages: false,
    approvalRequest: null,
  });
  const [connectionAttempt, setConnectionAttempt] = useState(0);

  const messagesRef = useRef<SessionMessage[]>([]);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectRetryCountRef = useRef(0);
  const reconnectSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      reconnectRetryCountRef.current = 0;
      reconnectSessionIdRef.current = null;
      setState({ messages: [], isStreaming: false, isLoadingMessages: false, approvalRequest: null });
      messagesRef.current = [];
      return;
    }

    if (reconnectSessionIdRef.current !== sessionId) {
      reconnectSessionIdRef.current = sessionId;
      reconnectRetryCountRef.current = 0;
    }

    const cached = getCachedSessionEntry(sessionId);
    setState(getInitialSessionStreamState(sessionId, cached.messages));

    // Reset ref so server-replayed history starts from empty — prevents
    // duplication when the modal is closed and reopened (cache + replay).
    messagesRef.current = [];

    let isStreaming = false;
    let isDisposed = false;
    let hasEnded = false;

    void fetchSessionConversationMessages(sessionId).then((hydrated) => {
      if (isDisposed) return;

      if (!hydrated) {
        setState((prev) => ({ ...prev, isLoadingMessages: false }));
        return;
      }

      // The conversation API fetches directly from the agent and is the
      // most complete source. Always apply it — but during an active
      // stream, only use it when it changes the replayed snapshot.
      const nextMessages = isStreaming ? resolveRecoveredStreamMessages(messagesRef.current, hydrated) : hydrated;
      if (nextMessages === messagesRef.current) {
        setState((prev) => ({ ...prev, isLoadingMessages: false }));
        return;
      }

      messagesRef.current = nextMessages;
      updateCachedSessionEntry(sessionId, { messages: nextMessages });
      setState((prev) => ({ ...prev, messages: nextMessages, isLoadingMessages: false }));
    });

    let streamConnection: { close: () => void } | null = null;

    streamConnection = getApiClient().sessions.connectStream(
      sessionId,
      {
        onReady: () => {
          isStreaming = true;
          reconnectRetryCountRef.current = 0;
          setState((prev) => ({ ...prev, isStreaming: true }));
        },
        onPatch: (data) => {
          isStreaming = true;
          reconnectRetryCountRef.current = 0;
          const patch = data as JsonPatch;
          messagesRef.current = applyMessagePatch(messagesRef.current, patch);
          updateCachedSessionEntry(sessionId, { messages: messagesRef.current });
          setState((prev) => ({
            ...prev,
            messages: messagesRef.current,
            isStreaming: true,
            isLoadingMessages: false,
            approvalRequest: null,
          }));
        },
        onApprovalRequest: (data) => {
          const request = data as ApprovalRequest;
          setState((prev) => ({ ...prev, approvalRequest: request }));
        },
        onEnd: () => {
          hasEnded = true;
          const cachedMessages = getCachedSessionEntry(sessionId).messages;
          const finalMessages = resolveStreamEndMessages(messagesRef.current, cachedMessages);

          updateCachedSessionEntry(sessionId, { messages: finalMessages });
          setState((prev) => ({
            ...prev,
            messages: finalMessages,
            isStreaming: false,
            isLoadingMessages: false,
            approvalRequest: null,
          }));
          streamConnection?.close();
        },
        onError: () => {
          if (isDisposed || hasEnded) {
            return;
          }

          setState((prev) => ({ ...prev, isStreaming: false, approvalRequest: null }));
          streamConnection?.close();

          void fetchSessionConversationMessages(sessionId).then((hydrated) => {
            if (isDisposed || hasEnded) return;

            const recoveredMessages = resolveRecoveredStreamMessages(messagesRef.current, hydrated);
            if (recoveredMessages === messagesRef.current) return;

            messagesRef.current = recoveredMessages;
            updateCachedSessionEntry(sessionId, { messages: recoveredMessages });
            setState((prev) => ({ ...prev, messages: recoveredMessages }));
          });

          if (reconnectTimerRef.current) {
            return;
          }

          const retryDelayMs = getSessionStreamReconnectDelayMs(reconnectRetryCountRef.current);
          reconnectRetryCountRef.current += 1;
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            if (!isDisposed && !hasEnded) {
              setConnectionAttempt((attempt) => attempt + 1);
            }
          }, retryDelayMs);
        },
      },
      { attempt: connectionAttempt },
    );

    return () => {
      isDisposed = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      streamConnection?.close();
    };
  }, [sessionId, connectionAttempt]);

  const reconnect = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectRetryCountRef.current = 0;
    setConnectionAttempt((attempt) => attempt + 1);
  };

  return { ...state, reconnect };
};
