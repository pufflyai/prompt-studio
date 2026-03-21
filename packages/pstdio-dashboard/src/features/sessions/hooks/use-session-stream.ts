import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { useEffect, useRef, useState } from "react";

import { buildApiUrl } from "@/lib/api";
import { fetchSessionConversationMessages, resolveStreamEndMessages } from "./session-conversation-hydration";
import {
  applyMessagePatch,
  getCachedSessionEntry,
  type JsonPatch,
  updateCachedSessionEntry,
} from "./session-stream-cache";

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
  approvalRequest: ApprovalRequest | null;
}

export const useSessionStream = (sessionId: string | null) => {
  const [state, setState] = useState<SessionStreamState>({
    messages: [],
    isStreaming: false,
    approvalRequest: null,
  });
  const [connectionAttempt, setConnectionAttempt] = useState(0);

  const messagesRef = useRef<SessionMessage[]>([]);

  useEffect(() => {
    if (!sessionId) {
      setState({ messages: [], isStreaming: false, approvalRequest: null });
      messagesRef.current = [];
      return;
    }

    const cached = getCachedSessionEntry(sessionId);
    setState({
      messages: cached.messages,
      isStreaming: true,
      approvalRequest: null,
    });

    // Reset ref so server-replayed history starts from empty — prevents
    // duplication when the modal is closed and reopened (cache + replay).
    messagesRef.current = [];

    let isStreaming = false;
    let isDisposed = false;

    void fetchSessionConversationMessages(sessionId).then((hydrated) => {
      if (!hydrated || isDisposed) return;

      // The conversation API fetches directly from the agent and is the
      // most complete source. Always apply it — but during an active
      // stream, only use it if it has more messages than what the stream
      // has replayed so far, to avoid overwriting live patches.
      if (isStreaming && hydrated.length <= messagesRef.current.length) return;

      messagesRef.current = hydrated;
      updateCachedSessionEntry(sessionId, { messages: hydrated });
      setState((prev) => ({ ...prev, messages: hydrated }));
    });

    const url = buildApiUrl(`/v1/sessions/${sessionId}/stream?attempt=${connectionAttempt}`);
    const source = new EventSource(url);

    source.addEventListener("patch", (event) => {
      isStreaming = true;
      const patch = JSON.parse(event.data) as JsonPatch;
      messagesRef.current = applyMessagePatch(messagesRef.current, patch);
      updateCachedSessionEntry(sessionId, { messages: messagesRef.current });
      setState((prev) => ({ ...prev, messages: messagesRef.current, approvalRequest: null }));
    });

    source.addEventListener("approval_request", (event) => {
      const request = JSON.parse(event.data) as ApprovalRequest;
      setState((prev) => ({ ...prev, approvalRequest: request }));
    });

    source.addEventListener("end", () => {
      const cachedMessages = getCachedSessionEntry(sessionId).messages;
      const finalMessages = resolveStreamEndMessages(messagesRef.current, cachedMessages);

      updateCachedSessionEntry(sessionId, { messages: finalMessages });
      setState((prev) => ({
        ...prev,
        messages: finalMessages,
        isStreaming: false,
        approvalRequest: null,
      }));
      source.close();
    });

    source.onerror = () => {
      setState((prev) => ({ ...prev, isStreaming: false }));
      source.close();
    };

    return () => {
      isDisposed = true;
      source.close();
    };
  }, [sessionId, connectionAttempt]);

  const reconnect = () => {
    setConnectionAttempt((attempt) => attempt + 1);
  };

  return { ...state, reconnect };
};
