import { Button } from "@chakra-ui/react";
import { ApprovalPrompt, ChatWorkspaceHub } from "@pstdio/ui/chat-ui";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { buildSessionWorkspaceHubModel } from "../utils/workspace-hub";
import { submitApprovalDecision } from "./session-chat-view-actions";

type WorkspaceHubModelInput = Parameters<typeof buildSessionWorkspaceHubModel>[0];

type ApprovalRequest = {
  id: string;
  toolName: string;
  toolInput: unknown;
};

export const SessionChatWorkspaceHubPanel = (
  props: WorkspaceHubModelInput & {
    showWorkspaceHub: boolean;
    isWorkspaceInitializing: boolean;
    statusLabel: string;
    changesLabel: (count: number) => string;
  },
) => {
  if (!props.showWorkspaceHub) {
    return undefined;
  }

  const workspaceHub = buildSessionWorkspaceHubModel({
    projectId: props.projectId,
    workspace: props.workspace,
    diffSummary: props.diffSummary,
  });

  if (!props.isWorkspaceInitializing && !workspaceHub) {
    return undefined;
  }

  return (
    <ChatWorkspaceHub
      status={props.isWorkspaceInitializing ? "loading" : "ready"}
      statusLabel={props.statusLabel}
      changesLabel={workspaceHub ? props.changesLabel(workspaceHub.fileCount) : ""}
      additions={workspaceHub?.additions ?? 0}
      deletions={workspaceHub?.deletions ?? 0}
      action={
        workspaceHub ? (
          <Button size="sm" variant="plain" asChild>
            <Link to={workspaceHub.href}>
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
