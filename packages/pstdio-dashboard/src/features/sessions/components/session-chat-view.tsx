import { ApprovalPrompt, ChatPanel } from "@pstdio/ui/chat-ui";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useProjectSettingsStore } from "@/features/project-settings/store";
import { apiRequest } from "@/lib/api";
import { useFollowUpSession } from "../hooks/use-follow-up-session";
import { useSessionStream } from "../hooks/use-session-stream";
import {
  createPendingFollowUpState,
  mergeMessagesWithPendingFollowUp,
  type PendingFollowUpState,
  shouldClearPendingFollowUp,
} from "./session-chat-state";

interface SessionChatViewProps {
  sessionId: string | null;
  agent?: string;
  model?: string;
  onCreateSession?: (prompt: string) => void;
  repoMenu?: ReactNode;
}

export const SessionChatView = (props: SessionChatViewProps) => {
  const { t } = useTranslation("projects");
  const { sessionId, agent, model, onCreateSession, repoMenu } = props;
  const draftKey = sessionId ?? "__new__";
  const chatDraft = useProjectSettingsStore((state) => state.chatDraftsBySession[draftKey] ?? "");
  const setSessionDraft = useProjectSettingsStore((state) => state.setSessionDraft);
  const clearSessionDraft = useProjectSettingsStore((state) => state.clearSessionDraft);
  const { messages, isStreaming, approvalRequest, reconnect } = useSessionStream(sessionId);
  const followUp = useFollowUpSession();
  const [pendingFollowUp, setPendingFollowUp] = useState<PendingFollowUpState | null>(null);
  const pendingIdRef = useRef(0);
  const lastSessionIdRef = useRef<string | null>(sessionId);

  useEffect(() => {
    if (lastSessionIdRef.current !== sessionId) {
      lastSessionIdRef.current = sessionId;
      setPendingFollowUp(null);
    }
  }, [sessionId]);

  useEffect(() => {
    if (shouldClearPendingFollowUp(pendingFollowUp, messages)) {
      setPendingFollowUp(null);
    }
  }, [messages, pendingFollowUp]);

  const handleSubmitMessage = (text: string) => {
    if (!sessionId) {
      clearSessionDraft(null);
      onCreateSession?.(text);
      return;
    }

    clearSessionDraft(sessionId);

    const pendingId = `pending-${pendingIdRef.current}`;
    pendingIdRef.current += 1;
    setPendingFollowUp(
      createPendingFollowUpState({
        prompt: text,
        messageCount: messages.length,
        pendingId,
      }),
    );

    followUp.mutate(
      { sessionId, prompt: text, agent, model },
      {
        onSuccess: reconnect,
        onError: () => setPendingFollowUp(null),
      },
    );
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

  const displayedMessages = mergeMessagesWithPendingFollowUp(messages, pendingFollowUp);

  return (
    <ChatPanel
      messages={displayedMessages}
      streaming={isStreaming}
      emptyStateTitle={t("sessions.noSessionSelected")}
      emptyStateDescription={t("sessions.selectSession")}
      chatInputPlaceholder={t("sessions.followUpPlaceholder")}
      chatInputDefaultValue={chatDraft}
      onSubmitMessage={(text: string) => handleSubmitMessage(text)}
      onChatInputChange={(text: string) => setSessionDraft(sessionId, text)}
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
