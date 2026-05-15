import { ApprovalPrompt } from "@pstdio/ui/chat-ui";
import { submitApprovalDecision } from "../data/session-approval";

interface ApprovalRequest {
  id: string;
  toolName: string;
  toolInput: unknown;
}

interface SessionApprovalPromptProps {
  sessionId: string | null;
  approvalRequest: ApprovalRequest | null;
}

export const SessionApprovalPrompt = (props: SessionApprovalPromptProps) => {
  const { sessionId, approvalRequest } = props;

  if (!approvalRequest) return undefined;

  return (
    <ApprovalPrompt
      toolName={approvalRequest.toolName}
      toolInput={approvalRequest.toolInput}
      onApprove={() =>
        submitApprovalDecision({
          sessionId,
          approvalRequestId: approvalRequest.id,
          decision: "approve",
        })
      }
      onDeny={() =>
        submitApprovalDecision({
          sessionId,
          approvalRequestId: approvalRequest.id,
          decision: "deny",
        })
      }
    />
  );
};
