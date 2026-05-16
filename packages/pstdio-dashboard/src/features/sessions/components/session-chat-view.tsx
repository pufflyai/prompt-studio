import { Box, Flex } from "@chakra-ui/react";
import { ChatPanel, ChatSkeleton } from "@pstdio/ui/chat-ui";
import { useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AgentBrowserContainer } from "@/features/agents/components/agent-browser.container";
import { useTicketAttemptDiffSummary } from "@/features/ticket/hooks/use-ticket-attempt-diff-summary";
import { RepoBrowserContainer } from "@/features/workspaces/components/repo-browser.container";
import { useInvalidateDiffOnEdits } from "@/features/workspaces/hooks/use-invalidate-diff-on-edits";
import type { CodingAgent } from "@/shared/agent-storage";
import { useProjectSettingsStore, useProjectSettingsStoreApi } from "@/shared/stores/project-settings";
import { useCreateProjectSession } from "../hooks/use-create-project-session";
import { useFollowUpSession } from "../hooks/use-follow-up-session";
import { useProjectSession } from "../hooks/use-project-session";
import { useSessionStatus } from "../hooks/use-session-status";
import { useSessionStream } from "../hooks/use-session-stream";
import { useSessionWorkspace } from "../hooks/use-session-workspace";
import { useStopSession } from "../hooks/use-stop-session";
import { buildSessionWorkspaceHubPanelModel } from "../utils/workspace-hub";
import { resolveInitialSessionChatSelection } from "./session-chat-selection";
import {
  mergeMessagesWithPendingFollowUp,
  mergeMessagesWithQueuedStatus,
  type PendingFollowUpState,
  shouldShowPendingFollowUp,
} from "./session-chat-state";
import {
  getVisibleActiveQuestionPromptState,
  isSessionChatStreaming,
  isSessionConversationLoading,
  isSessionInterruptible,
  isSessionRuntimeControlsDisabled,
  resolveNewSessionWorkspaceId,
} from "./session-chat-view.utils";
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
  autoFocusChatInput?: boolean;
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
    autoFocusChatInput = false,
  } = props;
  const { projectId } = useParams({ strict: false });

  const lastSelectedAgent = useProjectSettingsStore((s) => s.lastSelectedAgent);
  const lastSelectedModels = useProjectSettingsStore((s) => s.lastSelectedModels);
  const { data: session, isLoading: isSessionLoading } = useProjectSession(projectId, sessionId);
  const initialSelection = resolveInitialSessionChatSelection({
    sessionAgent: session?.agent,
    sessionLastSelectedModel: session?.lastSelectedModel,
    lastSelectedAgent,
    lastSelectedModels,
  });
  const [agent, setAgent] = useState<CodingAgent>(initialSelection.agent);
  const [model, setModel] = useState(initialSelection.model);
  const selectionResetKey = `${sessionId ?? "__new__"}:${session?.agent ?? ""}:${session?.lastSelectedModel ?? ""}`;
  const selectionResetKeyRef = useRef("");

  const projectSettingsStore = useProjectSettingsStoreApi();
  const draftKey = sessionId ?? "__new__";
  const [chatDraft, setChatDraft] = useState(() => projectSettingsStore.getState().chatDraftsBySession[draftKey] ?? "");
  const setSessionDraft = useProjectSettingsStore((state) => state.setSessionDraft);
  const clearSessionDraft = useProjectSettingsStore((state) => state.clearSessionDraft);
  const { messages, isStreaming, isLoadingMessages, approvalRequest, reconnect } = useSessionStream(sessionId);
  const sessionWorkspace = useSessionWorkspace(sessionId);
  const invalidateDiffOnEdit = useInvalidateDiffOnEdits(workspaceId ?? sessionWorkspace?.id ?? null);
  const { data: workspaceDiffSummary } = useTicketAttemptDiffSummary(showWorkspaceHub ? sessionWorkspace?.id : null);
  const createSession = useCreateProjectSession();
  const followUp = useFollowUpSession();
  const stopSession = useStopSession();
  const [pendingFollowUp, setPendingFollowUp] = useState<PendingFollowUpState | null>(null);
  const [submittedQuestionPromptSignature, setSubmittedQuestionPromptSignature] = useState("");
  const pendingIdRef = useRef(0);
  const editCountRef = useRef(0);
  const isWorkspaceInitializing = sessionWorkspace?.initializing ?? false;

  const sessionStatus = useSessionStatus(sessionId);

  useResetEditCountOnSessionChange(sessionId, editCountRef);
  useReconnectWhenWorkspaceReady(isWorkspaceInitializing, reconnect);
  useReconnectOnExternalResume(sessionStatus, isStreaming, reconnect);
  useEditActionNotifier(
    messages,
    () => {
      invalidateDiffOnEdit();
      onEditAction?.();
    },
    editCountRef,
  );
  useSyncPendingFollowUp({
    messages,
    pendingFollowUp,
    sessionId,
    setPendingFollowUp,
  });

  useEffect(() => {
    setChatDraft(projectSettingsStore.getState().chatDraftsBySession[draftKey] ?? "");
  }, [draftKey, projectSettingsStore]);

  useEffect(() => {
    if (selectionResetKeyRef.current === selectionResetKey) return;

    selectionResetKeyRef.current = selectionResetKey;

    const nextSelection = resolveInitialSessionChatSelection({
      sessionAgent: session?.agent,
      sessionLastSelectedModel: session?.lastSelectedModel,
      lastSelectedAgent,
      lastSelectedModels,
    });
    setAgent(nextSelection.agent);
    setModel(nextSelection.model);
  }, [selectionResetKey, session?.agent, session?.lastSelectedModel, lastSelectedAgent, lastSelectedModels]);

  const messagesWithPendingFollowUp = mergeMessagesWithPendingFollowUp(
    messages,
    shouldShowPendingFollowUp(pendingFollowUp, sessionId) ? pendingFollowUp : null,
  );
  const queuedStatusNotice =
    sessionStatus === "queued" && sessionId
      ? { sessionId, title: t("sessions.queuedStatus.title"), message: t("sessions.queuedStatus.message") }
      : null;
  const displayedMessages = mergeMessagesWithQueuedStatus(messagesWithPendingFollowUp, queuedStatusNotice);
  const activeQuestionPromptState = getVisibleActiveQuestionPromptState(
    displayedMessages,
    submittedQuestionPromptSignature,
  );
  const { questionPrompt: activeQuestionPrompt, signature: activeQuestionPromptSignature } = activeQuestionPromptState;
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
  const canInterruptSession = Boolean(sessionId) && isSessionInterruptible(sessionStatus);
  const statusAllowsStreaming = sessionStatus == null || canInterruptSession;
  const isConversationLoading = isSessionConversationLoading({
    sessionId,
    hasSession: Boolean(session),
    isSessionLoading,
    isMessageLoading: isLoadingMessages,
  });
  const runtimeControlsDisabled = isSessionRuntimeControlsDisabled({ sessionStatus, isConversationLoading });
  const effectiveStreaming = isSessionChatStreaming({
    isConversationLoading,
    isWorkspaceInitializing,
    isStreaming,
    statusAllowsStreaming,
    canInterruptSession,
  });
  const emptyStateTitle = sessionId ? t("chatInput.session.notFoundTitle") : t("sessions.nextBuildTitle");
  const emptyStateDescription = sessionId ? t("chatInput.session.notFoundDescription") : "";
  const effectiveWorkspaceId = resolveNewSessionWorkspaceId({
    sessionId,
    workspaceId,
    newSessionWorkspaceId,
  });

  return (
    <ChatPanel
      conversationKey={sessionId ?? "new-session"}
      messages={displayedMessages}
      loading={isConversationLoading}
      streaming={effectiveStreaming}
      workspaceInitializing={isWorkspaceInitializing}
      emptyStateTitle={emptyStateTitle}
      emptyStateDescription={emptyStateDescription}
      loaderComponent={<ChatSkeleton />}
      chatInputPlaceholder={t("sessions.followUpPlaceholder")}
      chatInputDefaultValue={chatDraft}
      inputDisabled={runtimeControlsDisabled}
      chatInputQuestionPrompt={activeQuestionPrompt}
      chatInputAutoFocus={autoFocusChatInput}
      onSubmitMessage={(text: string, _attachments, questionResponse) => {
        if (questionResponse && activeQuestionPromptSignature) {
          setSubmittedQuestionPromptSignature(activeQuestionPromptSignature);
        }

        return submitSessionMessage({
          sessionId,
          projectId,
          agent,
          model,
          workspaceId: effectiveWorkspaceId,
          text,
          questionResponse,
          messages,
          pendingIdRef,
          clearSessionDraft,
          setChatDraft,
          setPendingFollowUp,
          createSession,
          followUp,
          reconnect,
          onQuestionResponseError: () => setSubmittedQuestionPromptSignature(""),
          onSessionCreated,
        });
      }}
      onInterrupt={
        sessionId && canInterruptSession && !stopSession.isPending ? () => stopSession.mutate(sessionId) : undefined
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
            <AgentBrowserContainer
              sessionId={sessionId}
              selectedAgent={agent}
              selectedModel={model}
              onAgentChange={setAgent}
              onModelChange={setModel}
              isDisabled={runtimeControlsDisabled}
            />
          </Box>
          <RepoBrowserContainer
            sessionId={sessionId}
            workspaceId={effectiveWorkspaceId}
            isSessionContext
            isDisabled={runtimeControlsDisabled}
          />
        </Flex>
      }
      approvalPrompt={<SessionChatApprovalPromptPanel sessionId={sessionId} approvalRequest={approvalRequest} />}
    />
  );
};
