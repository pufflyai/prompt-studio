import { Box, Button, Flex } from "@chakra-ui/react";
import { ApprovalPrompt, ChatPanel, ChatSkeleton, ChatWorkspaceHub } from "@pstdio/ui/chat-ui";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AgentBrowserContainer } from "@/features/agents/components/agent-browser.container";
import { useProjectSettingsStore, useProjectSettingsStoreApi } from "@/features/project-settings/store";
import { useTicketAttemptDiffSummary } from "@/features/ticket/hooks/use-ticket-attempt-diff-summary";
import { RepoBrowserContainer } from "@/features/workspaces/components/repo-browser.container";
import { apiRequest } from "@/lib/api";
import { useCreateProjectSession } from "../hooks/use-create-project-session";
import { useFollowUpSession } from "../hooks/use-follow-up-session";
import { useSessionAgent } from "../hooks/use-session-agent";
import { useSessionStream } from "../hooks/use-session-stream";
import { useSessionWorkspace } from "../hooks/use-session-workspace";
import { buildSessionWorkspaceHubModel } from "../utils/workspace-hub";
import {
  assignPendingFollowUpSession,
  createPendingFollowUpState,
  mergeMessagesWithPendingFollowUp,
  type PendingFollowUpState,
  shouldClearPendingFollowUp,
  shouldShowPendingFollowUp,
} from "./session-chat-state";

const EDIT_ACTION_TYPES = new Set(["write", "execute"]);

interface SessionChatViewProps {
  sessionId: string | null;
  onSessionCreated?: (sessionId: string) => void;
  onEditAction?: () => void;
  showWorkspaceHub?: boolean;
}

export const SessionChatView = (props: SessionChatViewProps) => {
  const { t } = useTranslation(["projects", "tickets"]);
  const { sessionId, onSessionCreated, onEditAction, showWorkspaceHub = true } = props;
  const { projectId } = useParams({ strict: false });

  const sessionAgent = useSessionAgent(sessionId);
  const lastSelectedAgent = useProjectSettingsStore((s) => s.lastSelectedAgent);
  const lastSelectedModels = useProjectSettingsStore((s) => s.lastSelectedModels);
  const agent = sessionId && sessionAgent ? sessionAgent : lastSelectedAgent;
  const model = lastSelectedModels[0] ?? undefined;

  const projectSettingsStore = useProjectSettingsStoreApi();
  const draftKey = sessionId ?? "__new__";
  const [chatDraft, setChatDraft] = useState(() => projectSettingsStore.getState().chatDraftsBySession[draftKey] ?? "");
  const setSessionDraft = useProjectSettingsStore((state) => state.setSessionDraft);
  const clearSessionDraft = useProjectSettingsStore((state) => state.clearSessionDraft);
  const { messages, isStreaming, approvalRequest, reconnect } = useSessionStream(sessionId);
  const sessionWorkspace = useSessionWorkspace(sessionId);
  const { data: workspaceDiffSummary } = useTicketAttemptDiffSummary(showWorkspaceHub ? sessionWorkspace?.id : null);
  const createSession = useCreateProjectSession();
  const followUp = useFollowUpSession();
  const [pendingFollowUp, setPendingFollowUp] = useState<PendingFollowUpState | null>(null);
  const pendingIdRef = useRef(0);
  const lastSessionIdRef = useRef<string | null>(sessionId);
  const editCountRef = useRef(0);

  useEffect(() => {
    if (lastSessionIdRef.current !== sessionId) {
      lastSessionIdRef.current = sessionId;
      editCountRef.current = 0;
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

  useEffect(() => {
    if (!pendingFollowUp?.sessionId) {
      return;
    }

    if (pendingFollowUp.sessionId !== sessionId) {
      setPendingFollowUp(null);
    }
  }, [pendingFollowUp, sessionId]);

  const handleSubmitMessage = (text: string) => {
    const pendingId = `pending-${pendingIdRef.current}`;
    pendingIdRef.current += 1;

    if (!sessionId) {
      if (!projectId || !agent) return;
      clearSessionDraft(null);
      setChatDraft("");

      const pending = createPendingFollowUpState({
        prompt: text,
        messageCount: messages.length,
        pendingId,
      });
      setPendingFollowUp(pending);

      createSession.mutate(
        { projectId, prompt: text, agent, model },
        {
          onSuccess: ({ sessionId }) => {
            setPendingFollowUp((current) => {
              if (!current || current.userMessageId !== pending.userMessageId) {
                return current;
              }

              return assignPendingFollowUpSession(current, sessionId);
            });
            onSessionCreated?.(sessionId);
          },
          onError: () => {
            setPendingFollowUp((current) => {
              if (!current || current.userMessageId !== pending.userMessageId) {
                return current;
              }

              return null;
            });
          },
        },
      );
      return;
    }

    clearSessionDraft(sessionId);
    setChatDraft("");
    setPendingFollowUp(
      createPendingFollowUpState({
        prompt: text,
        messageCount: messages.length,
        pendingId,
        sessionId,
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

  const displayedMessages = mergeMessagesWithPendingFollowUp(
    messages,
    shouldShowPendingFollowUp(pendingFollowUp, sessionId) ? pendingFollowUp : null,
  );
  const loadingContent = sessionId ? <ChatSkeleton /> : undefined;
  const emptyStateTitle = sessionId ? t("chatInput.session.notFoundTitle") : t("sessions.nextBuildTitle");
  const emptyStateDescription = sessionId ? t("chatInput.session.notFoundDescription") : "";
  const workspaceHub = showWorkspaceHub
    ? buildSessionWorkspaceHubModel({
        projectId,
        workspace: sessionWorkspace,
        diffSummary: workspaceDiffSummary,
      })
    : null;

  return (
    <ChatPanel
      messages={displayedMessages}
      streaming={isStreaming}
      emptyStateTitle={emptyStateTitle}
      emptyStateDescription={emptyStateDescription}
      loadingContent={loadingContent}
      chatInputPlaceholder={t("sessions.followUpPlaceholder")}
      chatInputDefaultValue={chatDraft}
      onSubmitMessage={(text: string) => handleSubmitMessage(text)}
      onChatInputChange={(text: string) => setSessionDraft(sessionId, text)}
      workspaceHub={
        workspaceHub ? (
          <ChatWorkspaceHub
            changesLabel={t("tickets:diff.filesChanged", { count: workspaceHub.fileCount })}
            additions={workspaceHub.additions}
            deletions={workspaceHub.deletions}
            action={
              <Button size="sm" variant="plain" asChild>
                <Link to={workspaceHub.href}>
                  Review changes
                  <ArrowUpRight size={14} />
                </Link>
              </Button>
            }
          />
        ) : undefined
      }
      repoMenu={
        <Flex
          key={sessionId}
          justifyContent="space-between"
          align="center"
          gap="2xs"
          w="full"
          minW="0"
          px="xs"
          pb="xs"
          wrap="nowrap"
        >
          <Box flexShrink="0">
            <AgentBrowserContainer sessionId={sessionId} />
          </Box>
          <RepoBrowserContainer sessionId={sessionId} />
        </Flex>
      }
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
