import { Box, Flex } from "@chakra-ui/react";
import { ChatPanel, ChatSkeleton } from "@pstdio/ui/chat-ui";
import { useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AgentBrowserContainer } from "@/features/agents/components/agent-browser.container";
import { useProjectSettingsStore, useProjectSettingsStoreApi } from "@/features/project-settings/store";
import { useTicketAttemptDiffSummary } from "@/features/ticket/hooks/use-ticket-attempt-diff-summary";
import { RepoBrowserContainer } from "@/features/workspaces/components/repo-browser.container";
import { useCreateProjectSession } from "../hooks/use-create-project-session";
import { useFollowUpSession } from "../hooks/use-follow-up-session";
import { useSessionAgent } from "../hooks/use-session-agent";
import { useSessionStatus } from "../hooks/use-session-status";
import { useSessionStream } from "../hooks/use-session-stream";
import { useSessionWorkspace } from "../hooks/use-session-workspace";
import { buildSessionWorkspaceHubPanelModel } from "../utils/workspace-hub";
import {
  mergeMessagesWithPendingFollowUp,
  type PendingFollowUpState,
  shouldShowPendingFollowUp,
} from "./session-chat-state";
import { resolveNewSessionWorkspaceId } from "./session-chat-view.utils";
import { submitSessionMessage } from "./session-chat-view-actions";
import {
  useEditActionNotifier,
  useReconnectOnExternalResume,
  useReconnectWhenWorkspaceReady,
  useResetEditCountOnSessionChange,
  useSyncPendingFollowUp,
} from "./session-chat-view-hooks";
import { SessionChatApprovalPromptPanel, SessionChatWorkspaceHubPanel } from "./session-chat-view-panels";

interface SessionChatViewProps {
  sessionId: string | null;
  workspaceId?: string;
  newSessionWorkspaceId?: string;
  onSessionCreated?: (sessionId: string) => void;
  onEditAction?: () => void;
  showWorkspaceHub?: boolean;
}

export const SessionChatView = (props: SessionChatViewProps) => {
  const { t } = useTranslation(["projects", "tickets"]);
  const {
    sessionId,
    workspaceId,
    newSessionWorkspaceId,
    onSessionCreated,
    onEditAction,
    showWorkspaceHub = true,
  } = props;
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
  const editCountRef = useRef(0);
  const isWorkspaceInitializing = sessionWorkspace?.initializing ?? false;

  const sessionStatus = useSessionStatus(sessionId);

  useResetEditCountOnSessionChange(sessionId, editCountRef);
  useReconnectWhenWorkspaceReady(isWorkspaceInitializing, reconnect);
  useReconnectOnExternalResume(sessionStatus, isStreaming, reconnect);
  useEditActionNotifier(messages, onEditAction, editCountRef);
  useSyncPendingFollowUp({
    messages,
    pendingFollowUp,
    sessionId,
    setPendingFollowUp,
  });

  useEffect(() => {
    setChatDraft(projectSettingsStore.getState().chatDraftsBySession[draftKey] ?? "");
  }, [draftKey, projectSettingsStore]);

  const displayedMessages = mergeMessagesWithPendingFollowUp(
    messages,
    shouldShowPendingFollowUp(pendingFollowUp, sessionId) ? pendingFollowUp : null,
  );
  const workspaceHub = buildSessionWorkspaceHubPanelModel({
    showWorkspaceHub,
    isWorkspaceInitializing,
    setupError: sessionWorkspace?.setupError ?? null,
    projectId,
    workspace: sessionWorkspace,
    diffSummary: workspaceDiffSummary,
    statusLabel: t("tickets:conversation.workspace.settingUp"),
    changesLabel: (count) => t("tickets:diff.filesChanged", { count }),
  });
  const loadingContent = sessionId ? <ChatSkeleton /> : undefined;
  const effectiveStreaming = isStreaming || isWorkspaceInitializing;
  const emptyStateTitle = sessionId ? t("chatInput.session.notFoundTitle") : t("sessions.nextBuildTitle");
  const emptyStateDescription = sessionId ? t("chatInput.session.notFoundDescription") : "";
  const effectiveWorkspaceId = resolveNewSessionWorkspaceId({
    sessionId,
    workspaceId,
    newSessionWorkspaceId,
  });

  return (
    <ChatPanel
      messages={displayedMessages}
      streaming={effectiveStreaming}
      workspaceInitializing={isWorkspaceInitializing}
      emptyStateTitle={emptyStateTitle}
      emptyStateDescription={emptyStateDescription}
      loadingContent={loadingContent}
      chatInputPlaceholder={t("sessions.followUpPlaceholder")}
      chatInputDefaultValue={chatDraft}
      onSubmitMessage={(text: string) =>
        submitSessionMessage({
          sessionId,
          projectId,
          agent,
          model,
          workspaceId: effectiveWorkspaceId,
          text,
          messages,
          pendingIdRef,
          clearSessionDraft,
          setChatDraft,
          setPendingFollowUp,
          createSession,
          followUp,
          reconnect,
          onSessionCreated,
        })
      }
      onChatInputChange={(text: string) => setSessionDraft(sessionId, text)}
      workspaceHub={workspaceHub ? <SessionChatWorkspaceHubPanel {...workspaceHub} /> : undefined}
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
          <RepoBrowserContainer sessionId={sessionId} workspaceId={effectiveWorkspaceId} isSessionContext />
        </Flex>
      }
      approvalPrompt={<SessionChatApprovalPromptPanel sessionId={sessionId} approvalRequest={approvalRequest} />}
    />
  );
};
