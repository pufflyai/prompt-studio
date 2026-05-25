import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { useEffect, useState } from "react";
import { getApiClient } from "@/lib/api";
import {
  applyDashboardSessionMessagePatch,
  type DashboardSessionMessagePatch,
  fetchDashboardSessionConversationMessages,
  resolveDashboardStreamEndMessages,
} from "../data/session-messages";

interface DashboardSessionMessagesState {
  messages: SessionMessage[];
  loading: boolean;
  streaming: boolean;
}

const emptyState: DashboardSessionMessagesState = {
  messages: [],
  loading: false,
  streaming: false,
};

export const useDashboardSessionMessages = (sessionId: string | undefined) => {
  const [state, setState] = useState<DashboardSessionMessagesState>(emptyState);
  const [connectionAttempt, setConnectionAttempt] = useState(0);

  useEffect(() => {
    if (!sessionId) {
      setState(emptyState);
      return;
    }

    let isDisposed = false;
    let streamedMessages: SessionMessage[] = [];
    let hydratedMessages: SessionMessage[] = [];

    setState({ messages: [], loading: true, streaming: false });

    void fetchDashboardSessionConversationMessages(sessionId).then((messages) => {
      if (isDisposed || !messages) return;

      hydratedMessages = messages;
      if (streamedMessages.length > 0) {
        setState((current) => ({ ...current, loading: false }));
        return;
      }

      setState((current) => ({ ...current, messages, loading: false }));
    });

    const connection = getApiClient().sessions.connectStream(
      sessionId,
      {
        onReady: () => {
          if (isDisposed) return;
          setState((current) => ({ ...current, streaming: true }));
        },
        onPatch: (data) => {
          if (isDisposed) return;

          streamedMessages = applyDashboardSessionMessagePatch(streamedMessages, data as DashboardSessionMessagePatch);
          setState((current) => ({
            ...current,
            messages: streamedMessages,
            loading: false,
            streaming: true,
          }));
        },
        onEnd: () => {
          if (isDisposed) return;

          const messages = resolveDashboardStreamEndMessages(streamedMessages, hydratedMessages);
          setState({ messages, loading: false, streaming: false });
          connection.close();
        },
        onError: () => {
          if (isDisposed) return;
          setState((current) => ({ ...current, loading: false, streaming: false }));
        },
      },
      { attempt: connectionAttempt },
    );

    return () => {
      isDisposed = true;
      connection.close();
    };
  }, [sessionId, connectionAttempt]);

  const reconnect = () => setConnectionAttempt((attempt) => attempt + 1);

  return { ...state, reconnect };
};
