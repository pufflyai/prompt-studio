import { Box, Button, HStack } from "@chakra-ui/react";
import { ApprovalPrompt, ChatPanel, ChatSkeleton, type SessionMessage } from "@pstdio/ui/chat-ui";
import { useWorkbenchClaim } from "pstdio-workbench/react";
import { useEffect, useRef, useState } from "react";
import { apiRequest, getApiClient } from "@/lib/api";
import { dashboardResourceKindIds } from "@/services/workbench/resources/resource-kinds";

interface ApprovalRequest {
  id: string;
  toolName: string;
  toolInput: unknown;
}

interface SessionStreamState {
  messages: SessionMessage[];
  loading: boolean;
  streaming: boolean;
  approvalRequest: ApprovalRequest | null;
}

interface SessionConversationResponse {
  messages: SessionMessage[];
}

export interface JsonPatch {
  op: "add" | "replace" | "remove";
  path: string;
  value?: unknown;
}

const emptyStreamState: SessionStreamState = {
  messages: [],
  loading: false,
  streaming: false,
  approvalRequest: null,
};

const isEmptyTextLikePart = (part: SessionMessage["parts"][number]) => {
  if (part.type !== "text" && part.type !== "reasoning") return false;
  return part.text.trim().length === 0;
};

const sanitizeMessages = (messages: SessionMessage[]) => {
  const sanitized: SessionMessage[] = [];

  for (const message of messages) {
    const parts = message.parts.filter((part) => !isEmptyTextLikePart(part));
    if (parts.length === 0) continue;
    sanitized.push({ ...message, parts });
  }

  return sanitized;
};

export const applyMessagePatch = (messages: SessionMessage[], patch: JsonPatch): SessionMessage[] => {
  if (patch.path === "/messages" && (patch.op === "add" || patch.op === "replace")) {
    if (!Array.isArray(patch.value)) return sanitizeMessages(messages);
    return sanitizeMessages(patch.value as SessionMessage[]);
  }

  const match = patch.path.match(/^\/messages\/(\d+)$/);
  if (!match) return sanitizeMessages(messages);

  const index = Number(match[1]);
  const next = [...messages];

  if (patch.op === "add") {
    next.splice(index, 0, patch.value as SessionMessage);
  } else if (patch.op === "replace") {
    next[index] = patch.value as SessionMessage;
  } else if (patch.op === "remove") {
    next.splice(index, 1);
  }

  return sanitizeMessages(next);
};

const fetchSessionConversationMessages = async (sessionId: string) => {
  try {
    const payload = await apiRequest<SessionConversationResponse>(`/v1/sessions/${sessionId}/conversation`);
    return Array.isArray(payload.messages) ? payload.messages : [];
  } catch {
    return [];
  }
};

const useSelectedSessionStream = (sessionId: string | undefined) => {
  const [state, setState] = useState<SessionStreamState>(emptyStreamState);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const messagesRef = useRef<SessionMessage[]>([]);

  useEffect(() => {
    if (!sessionId) {
      messagesRef.current = [];
      setState(emptyStreamState);
      return;
    }

    let disposed = false;
    let hasStreamedPatch = false;
    let streamConnection: { close: () => void } | null = null;
    messagesRef.current = [];
    setState({ ...emptyStreamState, loading: true, streaming: true });

    void fetchSessionConversationMessages(sessionId).then((messages) => {
      if (disposed) return;
      if (hasStreamedPatch) {
        setState((current) => ({ ...current, loading: false }));
        return;
      }
      messagesRef.current = messages;
      setState((current) => ({ ...current, messages, loading: false }));
    });

    streamConnection = getApiClient().sessions.connectStream(
      sessionId,
      {
        onReady: () => {
          setState((current) => ({ ...current, streaming: true }));
        },
        onPatch: (data) => {
          hasStreamedPatch = true;
          messagesRef.current = applyMessagePatch(messagesRef.current, data as JsonPatch);
          setState((current) => ({
            ...current,
            messages: messagesRef.current,
            loading: false,
            streaming: true,
            approvalRequest: null,
          }));
        },
        onApprovalRequest: (data) => {
          setState((current) => ({ ...current, approvalRequest: data as ApprovalRequest }));
        },
        onEnd: () => {
          setState((current) => ({ ...current, loading: false, streaming: false, approvalRequest: null }));
          streamConnection?.close();
        },
        onError: () => {
          setState((current) => ({ ...current, loading: false, streaming: false, approvalRequest: null }));
          streamConnection?.close();
        },
      },
      { attempt: connectionAttempt },
    );

    return () => {
      disposed = true;
      streamConnection?.close();
    };
  }, [sessionId, connectionAttempt]);

  return { ...state, reconnect: () => setConnectionAttempt((attempt) => attempt + 1) };
};

const downloadSessionJson = async (sessionId: string, title: string) => {
  const messages = await fetchSessionConversationMessages(sessionId);
  const normalizedTitle = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const blob = new Blob([JSON.stringify({ sessionId, messages }, null, 2)], { type: "application/json" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = `${normalizedTitle || "session"}-${sessionId}.json`;
  anchor.click();
  URL.revokeObjectURL(href);
};

export const resolveClaimedSessionResource = (claim: ReturnType<typeof useWorkbenchClaim>) => {
  const resource = claim?.placement.resource;
  if (resource?.kind !== dashboardResourceKindIds.session || !resource.id) return undefined;
  return resource;
};

// Registered as a `keepAlive: true` renderer. The workbench reparents this
// subtree between the attached session panel and the floating bubble via DOM
// moves, so the message list and input draft survive surface transitions —
// replacing the dashboard's manual `appendChild` chat host workaround.
export const SessionChat = () => {
  const claim = useWorkbenchClaim();
  const resource = resolveClaimedSessionResource(claim);
  const sessionId = resource?.id;
  const title = resource?.label ?? "Session";
  const { messages, loading, streaming, approvalRequest, reconnect } = useSelectedSessionStream(sessionId);

  const followUp = (text: string) => {
    if (!sessionId) return;
    void apiRequest(`/v1/sessions/${sessionId}/follow-up`, { method: "POST", body: { prompt: text } }).then(reconnect);
  };

  const stopSession = () => {
    if (!sessionId) return;
    void apiRequest(`/v1/sessions/${sessionId}/status`, { method: "PATCH", body: { status: "cancelled" } }).then(
      reconnect,
    );
  };

  const archiveSession = () => {
    if (!sessionId) return;
    void apiRequest(`/v1/sessions/${sessionId}/archive`, { method: "POST" });
  };

  const submitApprovalDecision = (decision: "approve" | "deny") => {
    if (!sessionId || !approvalRequest) return;
    void apiRequest(`/v1/sessions/${sessionId}/approve`, {
      method: "POST",
      body: { id: approvalRequest.id, decision },
    }).then(reconnect);
  };

  return (
    <Box flex="1" minH="0" h="full">
      <ChatPanel
        conversationKey={sessionId ?? "pstdio-dashboard-workbench-session"}
        messages={messages}
        loading={loading}
        streaming={streaming}
        loaderComponent={<ChatSkeleton />}
        emptyStateTitle={sessionId ? title : "Select a session"}
        emptyStateDescription={
          sessionId ? "Live session history will appear here." : "Open a session to attach this chat."
        }
        chatInputPlaceholder="Send a follow-up…"
        inputDisabled={!sessionId || loading}
        onSubmitMessage={(text) => followUp(text)}
        onInterrupt={sessionId && streaming ? stopSession : undefined}
        actions={
          sessionId ? (
            <HStack gap="2xs">
              <Button size="xs" variant="ghost" onClick={() => void downloadSessionJson(sessionId, title)}>
                Download
              </Button>
              <Button size="xs" variant="ghost" onClick={archiveSession}>
                Archive
              </Button>
            </HStack>
          ) : undefined
        }
        approvalPrompt={
          approvalRequest ? (
            <ApprovalPrompt
              toolName={approvalRequest.toolName}
              toolInput={approvalRequest.toolInput}
              onApprove={() => submitApprovalDecision("approve")}
              onDeny={() => submitApprovalDecision("deny")}
            />
          ) : undefined
        }
      />
    </Box>
  );
};
