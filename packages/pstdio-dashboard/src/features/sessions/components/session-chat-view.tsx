import { ApprovalPrompt, ChatPanel } from "@pstdio/ui/chat-ui";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useProjectSettingsStore, useProjectSettingsStoreApi } from "@/features/project-settings/store";
import { apiRequest } from "@/lib/api";
import { useFollowUpSession } from "../hooks/use-follow-up-session";
import { useSessionStream } from "../hooks/use-session-stream";
import {
  createPendingFollowUpState,
  mergeMessagesWithPendingFollowUp,
  type PendingFollowUpState,
  shouldClearPendingFollowUp,
} from "./session-chat-state";

const EDIT_ACTION_TYPES = new Set(["write", "execute"]);

interface SessionChatViewProps {
  sessionId: string | null;
  agent?: string;
  model?: string;
  onCreateSession?: (prompt: string) => void;
  onEditAction?: () => void;
  repoMenu?: ReactNode;
}

export const SessionChatView = (props: SessionChatViewProps) => {
  const { t } = useTranslation("projects");
  const { sessionId, agent, model, onCreateSession, onEditAction, repoMenu } = props;
  const projectSettingsStore = useProjectSettingsStoreApi();
  const draftKey = sessionId ?? "__new__";
  const [chatDraft, setChatDraft] = useState(() => projectSettingsStore.getState().chatDraftsBySession[draftKey] ?? "");
  const setSessionDraft = useProjectSettingsStore((state) => state.setSessionDraft);
  const clearSessionDraft = useProjectSettingsStore((state) => state.clearSessionDraft);
  const { messages, isStreaming, approvalRequest, reconnect } = useSessionStream(sessionId);
  const followUp = useFollowUpSession();
  const [pendingFollowUp, setPendingFollowUp] = useState<PendingFollowUpState | null>(null);
  const pendingIdRef = useRef(0);
  const lastSessionIdRef = useRef<string | null>(sessionId);
  const editCountRef = useRef(0);

  useEffect(() => {
    if (lastSessionIdRef.current !== sessionId) {
      lastSessionIdRef.current = sessionId;
      editCountRef.current = 0;
      setPendingFollowUp(null);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!onEditAction) return;

    let count = 0;
    for (const msg of messages) {
      for (const part of msg.parts) {
        if (
          part.type === "tool" &&
          part.actionType &&
          EDIT_ACTION_TYPES.has(part.actionType) &&
          part.status === "completed"
        ) {
          count++;
        }
      }
    }

    if (count > editCountRef.current) {
      editCountRef.current = count;
      onEditAction();
    }
  }, [messages, onEditAction]);

  useEffect(() => {
    setChatDraft(projectSettingsStore.getState().chatDraftsBySession[draftKey] ?? "");
  }, [draftKey, projectSettingsStore]);

  useEffect(() => {
    if (shouldClearPendingFollowUp(pendingFollowUp, messages)) {
      setPendingFollowUp(null);
    }
  }, [messages, pendingFollowUp]);

  const handleSubmitMessage = (text: string) => {
    if (!sessionId) {
      clearSessionDraft(null);
      setChatDraft("");
      onCreateSession?.(text);
      return;
    }

    clearSessionDraft(sessionId);
    setChatDraft("");

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
