import { ApprovalPrompt, ChatPanel } from "@pstdio/ui/chat-ui";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/api";
import { useFollowUpSession } from "../hooks/use-follow-up-session";
import { useSessionStream } from "../hooks/use-session-stream";

interface SessionChatViewProps {
  sessionId: string | null;
  agent?: string;
  model?: string;
  onCreateSession?: (prompt: string) => void;
  repoMenu?: ReactNode;
}

interface FollowUpMutateOptions {
  onSuccess?: () => void;
}

interface SubmitSessionMessageInput {
  sessionId: string | null;
  text: string;
  agent?: string;
  model?: string;
  onCreateSession?: (prompt: string) => void;
  followUpMutate: (
    input: { sessionId: string; prompt: string; agent?: string; model?: string },
    options?: FollowUpMutateOptions,
  ) => void;
  reconnectStream: () => void;
}

export const submitSessionMessage = (input: SubmitSessionMessageInput) => {
  const { sessionId, text, agent, model, onCreateSession, followUpMutate, reconnectStream } = input;

  if (!sessionId) {
    onCreateSession?.(text);
    return;
  }

  followUpMutate(
    { sessionId, prompt: text, agent, model },
    {
      onSuccess: reconnectStream,
    },
  );
};

export const SessionChatView = (props: SessionChatViewProps) => {
  const { t } = useTranslation("projects");
  const { sessionId, agent, model, onCreateSession, repoMenu } = props;
  const { messages, isStreaming, approvalRequest, reconnect } = useSessionStream(sessionId);
  const followUp = useFollowUpSession();

  const handleSubmitMessage = (text: string) => {
    submitSessionMessage({
      sessionId,
      text,
      agent,
      model,
      onCreateSession,
      followUpMutate: followUp.mutate,
      reconnectStream: reconnect,
    });
  };

  const handleApprove = () => {
    if (!sessionId || !approvalRequest) return;
    apiRequest(`/v1/sessions/${sessionId}/approve`, {
      method: "POST",
      body: { id: approvalRequest.id, decision: "approve" },
    });
  };

  const handleDeny = () => {
    if (!sessionId || !approvalRequest) return;
    apiRequest(`/v1/sessions/${sessionId}/approve`, {
      method: "POST",
      body: { id: approvalRequest.id, decision: "deny" },
    });
  };

  return (
    <ChatPanel
      messages={messages}
      streaming={isStreaming}
      emptyStateTitle={t("sessions.noSessionSelected")}
      emptyStateDescription={t("sessions.selectSession")}
      chatInputPlaceholder={t("sessions.followUpPlaceholder")}
      onSubmitMessage={(text: string) => handleSubmitMessage(text)}
      repoMenu={repoMenu}
      approvalPrompt={
        approvalRequest ? (
          <ApprovalPrompt
            toolName={approvalRequest.toolName}
            toolInput={approvalRequest.toolInput}
            onApprove={handleApprove}
            onDeny={handleDeny}
          />
        ) : undefined
      }
    />
  );
};
