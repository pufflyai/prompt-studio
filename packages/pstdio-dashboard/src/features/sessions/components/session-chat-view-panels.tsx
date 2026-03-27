import { Button } from "@chakra-ui/react";
import { ApprovalPrompt, ChatWorkspaceHub } from "@pstdio/ui/chat-ui";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import type { buildSessionWorkspaceHubPanelModel } from "../utils/workspace-hub";
import { submitApprovalDecision } from "./session-chat-view-actions";

type SessionChatWorkspaceHubPanelProps = NonNullable<ReturnType<typeof buildSessionWorkspaceHubPanelModel>>;

type ApprovalRequest = {
  id: string;
  toolName: string;
  toolInput: unknown;
};

export const SessionChatWorkspaceHubPanel = (props: SessionChatWorkspaceHubPanelProps) => {
  const { href, ...workspaceHubProps } = props;

  return (
    <ChatWorkspaceHub
      {...workspaceHubProps}
      action={
        href ? (
          <Button size="sm" variant="plain" asChild>
            <Link to={href}>
              Review changes
              <ArrowUpRight size={14} />
            </Link>
          </Button>
        ) : undefined
      }
    />
  );
};

export const SessionChatApprovalPromptPanel = (props: {
  sessionId: string | null;
  approvalRequest: ApprovalRequest | null;
}) => {
  if (!props.approvalRequest) {
    return undefined;
  }

  return (
    <ApprovalPrompt
      toolName={props.approvalRequest.toolName}
      toolInput={props.approvalRequest.toolInput}
      onApprove={() =>
        submitApprovalDecision({
          sessionId: props.sessionId,
          approvalRequestId: props.approvalRequest?.id,
          decision: "approve",
        })
      }
      onDeny={() =>
        submitApprovalDecision({
          sessionId: props.sessionId,
          approvalRequestId: props.approvalRequest?.id,
          decision: "deny",
        })
      }
    />
  );
};
