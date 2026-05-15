import type { ChatInputQuestionResponse, SessionMessage } from "@pstdio/ui/chat-ui";
import { useEffect, useRef, useState } from "react";
import { buildApiUrl } from "@/lib/api";
import {
  assignPendingFollowUpSession,
  createPendingFollowUpState,
  mergeMessagesWithPendingFollowUp,
  type PendingFollowUpState,
  shouldClearPendingFollowUp,
  shouldResetPendingFollowUpForSession,
  shouldShowPendingFollowUp,
} from "./session-chat-state";
import {
  createConversationHydrationTracker,
  recordConversationCacheStep,
  recordConversationStreamEndStep,
  recordConversationStreamErrorStep,
  recordConversationStreamFirstPatchStep,
  recordConversationStreamOpenStep,
  recordConversationStreamReadyStep,
} from "./session-conversation-diagnostics";
import { fetchSessionConversationMessages, resolveStreamEndMessages } from "./session-conversation-hydration";
import {
  type ApprovalRequest,
  getInitialSessionConversationState,
  resolveSessionConversationSnapshot,
  type SessionConversationState,
} from "./session-conversation-state";
import { useCreateSession } from "./session-create";
import {
  applyMessagePatch,
  getCachedSessionEntry,
  type JsonPatch,
  updateCachedSessionEntry,
} from "./session-stream-cache";
import { getSessionStreamReconnectDelayMs, resolveRecoveredStreamMessages } from "./session-stream-recovery";
import { useFollowUpSession } from "./use-follow-up-session";

const resetStateForSession = (sessionId: string | null, cachedMessages: SessionMessage[]) =>
  getInitialSessionConversationState(sessionId, cachedMessages);

const initialSessionConversationState: SessionConversationState = {
  sessionId: null,
  messages: [],
  isStreaming: false,
  isLoadingMessages: false,
  approvalRequest: null,
};

export const useSessionConversation = (input: {
  sessionId: string | null;
  newSessionProjectId: string | null;
  onSessionCreated?: (sessionId: string) => void;
}) => {
  const { sessionId, newSessionProjectId, onSessionCreated } = input;
  const [state, setState] = useState<SessionConversationState>(initialSessionConversationState);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const messagesRef = useRef<SessionMessage[]>([]);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectRetryCountRef = useRef(0);
  const reconnectSessionIdRef = useRef<string | null>(null);
  const pendingIdRef = useRef(0);
  const [pendingFollowUp, setPendingFollowUp] = useState<PendingFollowUpState | null>(null);
  const createSession = useCreateSession();
  const followUp = useFollowUpSession();

  useEffect(() => {
    if (!sessionId) {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      reconnectRetryCountRef.current = 0;
      reconnectSessionIdRef.current = null;
      messagesRef.current = [];
      setState(resetStateForSession(null, []));
      return;
    }

    if (reconnectSessionIdRef.current !== sessionId) {
      reconnectSessionIdRef.current = sessionId;
      reconnectRetryCountRef.current = 0;
    }

    const cached = getCachedSessionEntry(sessionId);
    recordConversationCacheStep({ sessionId, cachedMessageCount: cached.messages.length, connectionAttempt });
    messagesRef.current = [];
    setState(resetStateForSession(sessionId, cached.messages));

    let isStreaming = false;
    let isDisposed = false;
    let hasEnded = false;
    let hasReceivedPatch = false;

    // Hydration is the complete source of truth; stream patches may reconnect or arrive before the first fetch finishes.
    const hydrationTracker = createConversationHydrationTracker(sessionId);
    void fetchSessionConversationMessages(sessionId).then((hydrated) => {
      if (isDisposed) return;

      hydrationTracker.finish(hydrated);

      if (!hydrated) {
        setState((current) => (current.sessionId === sessionId ? { ...current, isLoadingMessages: false } : current));
        return;
      }

      const nextMessages = isStreaming ? resolveRecoveredStreamMessages(messagesRef.current, hydrated) : hydrated;
      if (nextMessages === messagesRef.current) {
        setState((current) => (current.sessionId === sessionId ? { ...current, isLoadingMessages: false } : current));
        return;
      }

      messagesRef.current = nextMessages;
      updateCachedSessionEntry(sessionId, { messages: nextMessages });
      setState((current) =>
        current.sessionId === sessionId ? { ...current, messages: nextMessages, isLoadingMessages: false } : current,
      );
    });

    recordConversationStreamOpenStep(sessionId, connectionAttempt);
    const source = new EventSource(buildApiUrl(`/v1/sessions/${sessionId}/stream?attempt=${connectionAttempt}`));

    source.addEventListener("ready", () => {
      isStreaming = true;
      reconnectRetryCountRef.current = 0;
      recordConversationStreamReadyStep(sessionId, connectionAttempt);
      setState((current) => (current.sessionId === sessionId ? { ...current, isStreaming: true } : current));
    });

    source.addEventListener("patch", (event) => {
      isStreaming = true;
      reconnectRetryCountRef.current = 0;
      const patch = JSON.parse(event.data) as JsonPatch;
      messagesRef.current = applyMessagePatch(messagesRef.current, patch);
      updateCachedSessionEntry(sessionId, { messages: messagesRef.current });
      if (!hasReceivedPatch) {
        hasReceivedPatch = true;
        recordConversationStreamFirstPatchStep(sessionId, messagesRef.current);
      }
      setState((current) =>
        current.sessionId === sessionId
          ? {
              ...current,
              messages: messagesRef.current,
              isStreaming: true,
              isLoadingMessages: false,
              approvalRequest: null,
            }
          : current,
      );
    });

    source.addEventListener("approval_request", (event) => {
      const request = JSON.parse(event.data) as ApprovalRequest;
      setState((current) => (current.sessionId === sessionId ? { ...current, approvalRequest: request } : current));
    });

    source.addEventListener("end", () => {
      hasEnded = true;
      recordConversationStreamEndStep(sessionId);
      const cachedMessages = getCachedSessionEntry(sessionId).messages;
      const finalMessages = resolveStreamEndMessages(messagesRef.current, cachedMessages);

      updateCachedSessionEntry(sessionId, { messages: finalMessages });
      setState((current) =>
        current.sessionId === sessionId
          ? {
              ...current,
              messages: finalMessages,
              isStreaming: false,
              isLoadingMessages: false,
              approvalRequest: null,
            }
          : current,
      );
      source.close();
    });

    source.onerror = () => {
      if (isDisposed || hasEnded) return;

      setState((current) =>
        current.sessionId === sessionId ? { ...current, isStreaming: false, approvalRequest: null } : current,
      );
      source.close();

      void fetchSessionConversationMessages(sessionId).then((hydrated) => {
        if (isDisposed || hasEnded) return;

        const recoveredMessages = resolveRecoveredStreamMessages(messagesRef.current, hydrated);
        if (recoveredMessages === messagesRef.current) return;

        messagesRef.current = recoveredMessages;
        updateCachedSessionEntry(sessionId, { messages: recoveredMessages });
        setState((current) =>
          current.sessionId === sessionId ? { ...current, messages: recoveredMessages } : current,
        );
      });

      if (reconnectTimerRef.current) return;

      const retryDelayMs = getSessionStreamReconnectDelayMs(reconnectRetryCountRef.current);
      recordConversationStreamErrorStep({ sessionId, retryDelayMs, retryCount: reconnectRetryCountRef.current });
      reconnectRetryCountRef.current += 1;
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        if (!isDisposed && !hasEnded) {
          setConnectionAttempt((attempt) => attempt + 1);
        }
      }, retryDelayMs);
    };

    return () => {
      isDisposed = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      source.close();
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

  const snapshot = resolveSessionConversationSnapshot(sessionId, state);
  const visiblePendingFollowUp = shouldShowPendingFollowUp(pendingFollowUp, sessionId) ? pendingFollowUp : null;
  // Match the original dashboard by showing the submitted prompt and assistant loader before stream replay catches up.
  const messages = mergeMessagesWithPendingFollowUp(snapshot.messages, visiblePendingFollowUp);

  useEffect(() => {
    if (shouldClearPendingFollowUp(pendingFollowUp, snapshot.messages)) {
      setPendingFollowUp(null);
    }
  }, [pendingFollowUp, snapshot.messages]);

  useEffect(() => {
    if (sessionId && shouldResetPendingFollowUpForSession(pendingFollowUp, sessionId)) {
      setPendingFollowUp(null);
    }
  }, [pendingFollowUp, sessionId]);

  const submitMessage = async (text: string, questionResponse?: ChatInputQuestionResponse) => {
    const pendingId = `pending-${pendingIdRef.current}`;
    pendingIdRef.current += 1;

    if (!sessionId) {
      if (!newSessionProjectId) return;

      const pending = createPendingFollowUpState({
        prompt: text,
        messageCount: snapshot.messages.length,
        pendingId,
      });
      setPendingFollowUp(pending);

      try {
        const created = await createSession.mutateAsync({ projectId: newSessionProjectId, prompt: text });
        // Preserve the optimistic turn across the resource switch so a new session does not briefly lose its loader.
        setPendingFollowUp((current) =>
          current?.userMessageId === pending.userMessageId
            ? assignPendingFollowUpSession(current, created.sessionId)
            : current,
        );
        onSessionCreated?.(created.sessionId);
      } catch (error) {
        setPendingFollowUp((current) => (current?.userMessageId === pending.userMessageId ? null : current));
        throw error;
      }
      return;
    }

    const pending = questionResponse
      ? null
      : createPendingFollowUpState({
          prompt: text,
          messageCount: snapshot.messages.length,
          pendingId,
          sessionId,
        });
    setPendingFollowUp(pending);

    try {
      await followUp.mutateAsync({ sessionId, prompt: text, questionResponse });
      reconnect();
    } catch (error) {
      setPendingFollowUp(null);
      throw error;
    }
  };

  return {
    ...snapshot,
    messages,
    isSubmittingMessage: createSession.isPending || followUp.isPending,
    reconnect,
    submitMessage,
  };
};
