import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { useEffect, useRef, useState } from "react";
import { getApiClient } from "@/lib/api";
import {
  applyDashboardSessionMessagePatch,
  type DashboardSessionMessagePatch,
  fetchDashboardSessionConversationMessages,
  resolveDashboardStreamEndMessages,
} from "../data/session-messages";

export interface DashboardSessionMessagesState {
  messages: SessionMessage[];
  loading: boolean;
  streaming: boolean;
}

const emptyState: DashboardSessionMessagesState = {
  messages: [],
  loading: false,
  streaming: false,
};

interface NextStateForConnectionStartArgs {
  current: DashboardSessionMessagesState;
  isSessionChange: boolean;
}

// Reset messages only when switching sessions. A reconnect against the same
// session must keep the conversation rendered until fresh data arrives,
// otherwise the chat list briefly empties and remounts on follow-up submit.
export const nextStateForConnectionStart = (args: NextStateForConnectionStartArgs): DashboardSessionMessagesState => {
  if (args.isSessionChange) {
    return { messages: [], loading: true, streaming: false };
  }
  return { ...args.current, loading: true, streaming: false };
};

export const useDashboardSessionMessages = (sessionId: string | undefined) => {
  const [state, setState] = useState<DashboardSessionMessagesState>(emptyState);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const lastSessionIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!sessionId) {
      lastSessionIdRef.current = undefined;
      setState(emptyState);
      return;
    }

    const isSessionChange = lastSessionIdRef.current !== sessionId;
    lastSessionIdRef.current = sessionId;

    let isDisposed = false;
    let streamedMessages: SessionMessage[] = [];
    let hydratedMessages: SessionMessage[] = [];

    setState((current) => nextStateForConnectionStart({ current, isSessionChange }));

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
