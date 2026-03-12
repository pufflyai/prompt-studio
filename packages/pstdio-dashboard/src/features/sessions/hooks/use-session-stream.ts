import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { useEffect, useRef, useState } from "react";

import { buildApiUrl } from "@/lib/api";
import type { SessionStatus } from "../types";
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
  status: SessionStatus | null;
  isStreaming: boolean;
  approvalRequest: ApprovalRequest | null;
}

export const useSessionStream = (sessionId: string | null) => {
  const [state, setState] = useState<SessionStreamState>({
    messages: [],
    status: null,
    isStreaming: false,
    approvalRequest: null,
  });
  const [connectionAttempt, setConnectionAttempt] = useState(0);

  const messagesRef = useRef<SessionMessage[]>([]);

  useEffect(() => {
    if (!sessionId) {
      setState({ messages: [], status: null, isStreaming: false, approvalRequest: null });
      messagesRef.current = [];
      return;
    }

    const cached = getCachedSessionEntry(sessionId);
    setState({
      messages: cached.messages,
      status: cached.status,
      isStreaming: true,
      approvalRequest: null,
    });

    // Reset ref so server-replayed history starts from empty — prevents
    // duplication when the modal is closed and reopened (cache + replay).
    messagesRef.current = [];

    const url = buildApiUrl(`/v1/sessions/${sessionId}/stream?attempt=${connectionAttempt}`);
    const source = new EventSource(url);

    source.addEventListener("patch", (event) => {
      const patch = JSON.parse(event.data) as JsonPatch;
      messagesRef.current = applyMessagePatch(messagesRef.current, patch);
      updateCachedSessionEntry(sessionId, { messages: messagesRef.current });
      setState((prev) => ({ ...prev, messages: messagesRef.current, approvalRequest: null }));
    });

    source.addEventListener("approval_request", (event) => {
      const request = JSON.parse(event.data) as ApprovalRequest;
      setState((prev) => ({ ...prev, approvalRequest: request }));
    });

    source.addEventListener("end", (event) => {
      const { status } = JSON.parse(event.data) as { status: string };
      const resolvedStatus = status as SessionStatus;
      updateCachedSessionEntry(sessionId, { messages: messagesRef.current, status: resolvedStatus });
      setState((prev) => ({
        ...prev,
        status: resolvedStatus,
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
      source.close();
    };
  }, [sessionId, connectionAttempt]);

  const reconnect = () => {
    setConnectionAttempt((attempt) => attempt + 1);
  };

  return { ...state, reconnect };
};
