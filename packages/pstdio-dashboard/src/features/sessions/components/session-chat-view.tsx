import { Box, Flex, HStack, IconButton, Text } from "@chakra-ui/react";
import { ChatPanel, ChatSkeleton } from "@pstdio/ui/chat-ui";
import { useParams } from "@tanstack/react-router";
import { Paperclip, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AgentBrowserContainer } from "@/features/agents/components/agent-browser.container";
import { useProjectSettingsStore, useProjectSettingsStoreApi } from "@/features/project-settings/store";
import { useTicketAttemptDiffSummary } from "@/features/ticket/hooks/use-ticket-attempt-diff-summary";
import { RepoBrowserContainer } from "@/features/workspaces/components/repo-browser.container";
import { uploadSessionAttachment } from "../data/api";
import { useCreateProjectSession } from "../hooks/use-create-project-session";
import { useFollowUpSession } from "../hooks/use-follow-up-session";
import { useSessionAgent } from "../hooks/use-session-agent";
import { useSessionStatus } from "../hooks/use-session-status";
import { useSessionStream } from "../hooks/use-session-stream";
import { useSessionWorkspace } from "../hooks/use-session-workspace";
import { useStopSession } from "../hooks/use-stop-session";
import type { SessionPromptAttachment } from "../types";
import { buildSessionWorkspaceHubPanelModel } from "../utils/workspace-hub";
import {
  mergeMessagesWithPendingFollowUp,
  type PendingFollowUpState,
  shouldShowPendingFollowUp,
} from "./session-chat-state";
import {
  getActiveQuestionPrompt,
  isSessionInterruptible,
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
}

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to read attachment"));
        return;
      }

      const separator = result.indexOf(",");
      resolve(separator >= 0 ? result.slice(separator + 1) : result);
    };

    reader.onerror = () => {
      reject(new Error("Failed to read attachment"));
    };

    reader.readAsDataURL(file);
  });

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
  const stopSession = useStopSession();
  const [pendingFollowUp, setPendingFollowUp] = useState<PendingFollowUpState | null>(null);
  const [draftAttachments, setDraftAttachments] = useState<SessionPromptAttachment[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const pendingIdRef = useRef(0);
  const editCountRef = useRef(0);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
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
  const activeQuestionPrompt = useMemo(() => getActiveQuestionPrompt(displayedMessages), [displayedMessages]);
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
  const canInterruptSession = Boolean(sessionId) && isSessionInterruptible(sessionStatus);
  const statusAllowsStreaming = sessionStatus == null || canInterruptSession;
  const effectiveStreaming = isWorkspaceInitializing || (isStreaming && statusAllowsStreaming) || canInterruptSession;
  const emptyStateTitle = sessionId ? t("chatInput.session.notFoundTitle") : t("sessions.nextBuildTitle");
  const emptyStateDescription = sessionId ? t("chatInput.session.notFoundDescription") : "";
  const effectiveWorkspaceId = resolveNewSessionWorkspaceId({
    sessionId,
    workspaceId,
    newSessionWorkspaceId,
  });

  const clearDraftAttachments = () => setDraftAttachments([]);

  const removeDraftAttachment = (attachmentId: string) => {
    setDraftAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
  };

  const uploadAttachments = async (files: FileList | null) => {
    if (!projectId || !files || files.length === 0) {
      return;
    }

    setIsUploadingAttachment(true);
    const uploaded: SessionPromptAttachment[] = [];

    try {
      for (const file of Array.from(files)) {
        const base64 = await fileToBase64(file);
        const attachment = await uploadSessionAttachment({
          projectId,
          fileName: file.name,
          contentBase64: base64,
          mimeType: file.type,
        });
        uploaded.push(attachment);
      }
    } finally {
      setIsUploadingAttachment(false);
    }

    if (uploaded.length > 0) {
      setDraftAttachments((current) => [...current, ...uploaded]);
    }

    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = "";
    }
  };

  const attachmentList =
    draftAttachments.length > 0 ? (
      <HStack mb="sm" gap="1" flexWrap="wrap">
        {draftAttachments.map((attachment) => (
          <HStack key={attachment.id} bg="bg.subtle" px="2" py="1" borderRadius="sm" gap="1">
            <Text fontSize="xs" color="fg.subtle">
              {attachment.file_name}
            </Text>
            <IconButton
              size="2xs"
              variant="ghost"
              aria-label={`Remove ${attachment.file_name}`}
              onClick={() => removeDraftAttachment(attachment.id)}
            >
              <X size={12} />
            </IconButton>
          </HStack>
        ))}
      </HStack>
    ) : undefined;

  const inputActions = (
    <>
      <input
        ref={attachmentInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        hidden
        onChange={(event) => {
          void uploadAttachments(event.target.files);
        }}
      />
      <IconButton
        size="xs"
        variant="ghost"
        aria-label="Attach image"
        disabled={!projectId || isUploadingAttachment}
        onClick={() => attachmentInputRef.current?.click()}
      >
        <Paperclip size={14} />
      </IconButton>
    </>
  );

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
      chatInputQuestionPrompt={activeQuestionPrompt}
      onSubmitMessage={(text: string, _attachments, questionResponse) =>
        submitSessionMessage({
          sessionId,
          projectId,
          agent,
          model,
          workspaceId: effectiveWorkspaceId,
          text,
          attachments: draftAttachments,
          questionResponse,
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
      onClearAttachments={clearDraftAttachments}
      attachmentList={attachmentList}
      actions={inputActions}
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
            <AgentBrowserContainer sessionId={sessionId} />
          </Box>
          <RepoBrowserContainer sessionId={sessionId} workspaceId={effectiveWorkspaceId} isSessionContext />
        </Flex>
      }
      approvalPrompt={<SessionChatApprovalPromptPanel sessionId={sessionId} approvalRequest={approvalRequest} />}
    />
  );
};
