import { ApprovalPrompt, ChatPanel } from "@pstdio/ui/chat-ui";
import { apiRequest } from "@/lib/api";
import { useFollowUpSession } from "../hooks/use-follow-up-session";
import { useSessionStream } from "../hooks/use-session-stream";

interface SessionChatViewProps {
  sessionId: string | null;
}

export const SessionChatView = (props: SessionChatViewProps) => {
  const { sessionId } = props;
  const { messages, isStreaming, approvalRequest } = useSessionStream(sessionId);
  const followUp = useFollowUpSession();

  const handleSubmitMessage = (text: string) => {
    if (!sessionId) return;
    followUp.mutate({ sessionId, prompt: text });
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
      emptyStateTitle="No session selected"
      emptyStateDescription="Select a session from the sidebar or start a new one."
      chatInputPlaceholder="Send a follow-up message..."
      onSubmitMessage={(text: string) => handleSubmitMessage(text)}
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
