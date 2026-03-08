import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { useEffect, useRef, useState } from "react";
import { buildApiUrl } from "@/lib/api";
import type { SessionStatus } from "../types";

interface JsonPatch {
  op: "add" | "replace" | "remove";
  path: string;
  value?: unknown;
}

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

const applyPatch = (messages: SessionMessage[], patch: JsonPatch): SessionMessage[] => {
  const match = patch.path.match(/^\/messages\/(\d+)$/);
  if (!match) return messages;

  const index = Number(match[1]);
  const next = [...messages];

  if (patch.op === "add") {
    next.splice(index, 0, patch.value as SessionMessage);
  } else if (patch.op === "replace") {
    next[index] = patch.value as SessionMessage;
  } else if (patch.op === "remove") {
    next.splice(index, 1);
  }

  return next;
};

export const useSessionStream = (sessionId: string | null) => {
  const [state, setState] = useState<SessionStreamState>({
    messages: [],
    status: null,
    isStreaming: false,
    approvalRequest: null,
  });

  const messagesRef = useRef<SessionMessage[]>([]);

  useEffect(() => {
    if (!sessionId) {
      setState({ messages: [], status: null, isStreaming: false, approvalRequest: null });
      messagesRef.current = [];
      return;
    }

    messagesRef.current = [];
    setState({ messages: [], status: null, isStreaming: true, approvalRequest: null });

    const url = buildApiUrl(`/v1/sessions/${sessionId}/stream`);
    const source = new EventSource(url);

    source.addEventListener("patch", (event) => {
      const patch = JSON.parse(event.data) as JsonPatch;
      messagesRef.current = applyPatch(messagesRef.current, patch);
      setState((prev) => ({ ...prev, messages: messagesRef.current, approvalRequest: null }));
    });

    source.addEventListener("approval_request", (event) => {
      const request = JSON.parse(event.data) as ApprovalRequest;
      setState((prev) => ({ ...prev, approvalRequest: request }));
    });

    source.addEventListener("end", (event) => {
      const { status } = JSON.parse(event.data) as { status: string };
      setState((prev) => ({
        ...prev,
        status: status as SessionStatus,
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
  }, [sessionId]);

  return state;
};
