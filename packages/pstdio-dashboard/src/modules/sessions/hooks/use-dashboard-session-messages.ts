import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { useEffect, useRef, useState } from "react";
import { getApiClient } from "@/lib/api";
import { subscribeCollections } from "@/lib/sync/collections";
import {
  applyDashboardSessionMessagePatch,
  combineSessionMessageSources,
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

    let hydrationRequest = 0;
    const hydrate = async () => {
      const request = ++hydrationRequest;
      const messages = await fetchDashboardSessionConversationMessages(sessionId);
      if (isDisposed || !messages || request !== hydrationRequest) return;
      hydratedMessages = messages;
      setState((current) => ({
        ...current,
        messages: combineSessionMessageSources(streamedMessages, hydratedMessages, sessionId),
        loading: false,
      }));
    };
    void hydrate();
    const unsubscribe = subscribeCollections((change) => {
      if (!change || change.table === "sessions") void hydrate();
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
            messages: combineSessionMessageSources(streamedMessages, hydratedMessages, sessionId),
            loading: false,
            streaming: true,
          }));
        },
        onEnd: () => {
          if (isDisposed) return;

          const messages = resolveDashboardStreamEndMessages(streamedMessages, hydratedMessages);
          streamedMessages = [];
          setState({ messages, loading: false, streaming: false });
          void hydrate();
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
      unsubscribe();
      connection.close();
    };
  }, [sessionId, connectionAttempt]);

  const reconnect = () => setConnectionAttempt((attempt) => attempt + 1);

  return { ...state, reconnect };
};
