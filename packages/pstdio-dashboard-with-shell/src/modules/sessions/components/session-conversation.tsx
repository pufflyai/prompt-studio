import { ChatPanel, ChatSkeleton } from "@pstdio/ui/chat-ui";
import { useEffect } from "react";
import { recordSessionSwitchStep } from "../data/session-switch-diagnostics";
import { useSessionConversation } from "../data/use-session-conversation";
import { SessionApprovalPrompt } from "./session-approval-prompt";

interface SessionConversationProps {
  sessionId: string | null;
  newSessionProjectId: string | null;
  onSessionCreated: (sessionId: string) => void;
}

export const SessionConversation = (props: SessionConversationProps) => {
  const { sessionId, newSessionProjectId, onSessionCreated } = props;
  const { messages, isLoadingMessages, isStreaming, isSubmittingMessage, approvalRequest, submitMessage } =
    useSessionConversation({ sessionId, newSessionProjectId, onSessionCreated });
  const conversationKey = sessionId ?? "new-session";
  const isConversationLoading = Boolean(sessionId) && isLoadingMessages;
  // New-session submits are valid once the shell can infer a project target; the created session opens after the POST.
  const canSubmitMessage = Boolean(sessionId || newSessionProjectId);

  useEffect(() => {
    recordSessionSwitchStep({
      sessionId,
      step: "chat-panel.commit",
      metadata: { isConversationLoading, messageCount: messages.length },
    });
  }, [isConversationLoading, messages.length, sessionId]);

  return (
    <ChatPanel
      // ChatPanel keeps scroll state internally, so remount it when switching resources to open each session at the tail.
      key={conversationKey}
      conversationKey={conversationKey}
      messages={messages}
      loading={isConversationLoading}
      streaming={isConversationLoading || isStreaming || isSubmittingMessage}
      workspaceInitializing={false}
      emptyStateTitle={sessionId ? "No conversation" : "New session"}
      emptyStateDescription=""
      loaderComponent={<ChatSkeleton />}
      chatInputPlaceholder={sessionId ? "Follow up..." : "Start a new session..."}
      inputDisabled={!canSubmitMessage || isLoadingMessages || isSubmittingMessage}
      onSubmitMessage={
        canSubmitMessage ? (text, _attachments, questionResponse) => submitMessage(text, questionResponse) : undefined
      }
      approvalPrompt={<SessionApprovalPrompt sessionId={sessionId} approvalRequest={approvalRequest} />}
    />
  );
};
