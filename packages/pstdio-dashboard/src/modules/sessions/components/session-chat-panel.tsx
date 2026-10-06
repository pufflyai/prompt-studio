import { Box, IconButton } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { type ChatInputQuestionResponse, ChatPanel, ChatSkeleton } from "@pstdio/ui/chat-ui";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useWorkbenchStore } from "@pstdio/workbench/react";
import { ArrowUpRight } from "lucide-react";
import type { SessionAttachment } from "pstdio-api-contracts";
import type { ReactNode } from "react";
import { useApiFileParts } from "@/lib/api-file-url";
import { useAgents } from "@/shared/agents/use-agents";
import { dashboardSelectedProjectIdContextKey, getDashboardSelectedProjectId } from "@/shared/app/project-context";
import type { DashboardSessionDraftPersistence } from "@/shared/app/session-draft-persistence";
import { openWorkspacesPage } from "@/shared/workbench/page-navigation";
import {
  createDashboardWorkspaceOptionResource,
  createDashboardWorkspaceOptions,
  type DashboardWorkspaceOption,
} from "@/shared/workspaces/workspace-options";
import { createDraftCommandSession } from "../chat/create-draft-command-session";
import { splitQueuedFollowUps } from "../chat/queued-follow-ups";
import { openCreatedSessionFromDraft, submitSessionMessage } from "../chat/session-chat-actions";
import { updatePendingFollowUp } from "../chat/session-chat-state";
import { sessionDraftSubmission } from "../chat/session-draft-submission";
import { sessionUnsentActions } from "../chat/session-unsent-actions";
import type { DashboardSessionView } from "../data/dashboard-sessions";
import { useCreateProjectSession } from "../hooks/use-create-project-session";
import type { useDashboardSessionMessages } from "../hooks/use-dashboard-session-messages";
import { useFollowUpSession } from "../hooks/use-follow-up-session";
import { useQueuedSessionMessages } from "../hooks/use-queued-session-messages";
import { useStopSession } from "../hooks/use-stop-session";
import { canSubmitSessionMessage } from "../runtime/session-runtime-selection";
import type { HarnessParamValues } from "./harness-param-values";
import { SessionAttachmentControls } from "./session-attachment-controls";
import { SessionAttachmentList } from "./session-attachment-list";
import { SessionChatNotices } from "./session-chat-notices";
import { SessionChatWorkspaceHub } from "./session-chat-workspace-hub";
import { SessionComposerActions } from "./session-composer-actions";
import { useCommandComposer } from "./use-command-composer";
import { usePendingSessionFollowUp } from "./use-pending-session-follow-up";
import { useSessionChatDraft } from "./use-session-chat-draft";
import { useSessionDraftAttachments } from "./use-session-draft-attachments";
import { useSessionModelSelection } from "./use-session-model-selection";

interface DashboardSessionChatPanelProps {
  input: WorkbenchPanelRenderInput;
  view: DashboardSessionView;
  history: ReturnType<typeof useDashboardSessionMessages>;
  emptyStateTitle: string;
  emptyStateDescription: string;
  workspaceAction: ReactNode;
  drafts?: DashboardSessionDraftPersistence;
}

type SessionWorkspaceReviewView = Pick<
  DashboardSessionView,
  "workspaceBranch" | "workspaceId" | "workspaceShorthand" | "workspaceTitle"
>;

const createSessionWorkspaceResource = (
  view: SessionWorkspaceReviewView,
  projectId: string | undefined,
  workspaces: readonly DashboardWorkspaceOption[],
) => {
  if (!view.workspaceId) return undefined;
  const workspace = workspaces.find((candidate) => candidate.id === view.workspaceId);
  return workspace ? createDashboardWorkspaceOptionResource(workspace, projectId) : undefined;
};

export const openReviewWorkspace = (
  input: Pick<WorkbenchPanelRenderInput, "workbench">,
  view: SessionWorkspaceReviewView,
  workspaces = createDashboardWorkspaceOptions(getDashboardSelectedProjectId(input.workbench)),
) => {
  const resource = createSessionWorkspaceResource(view, getDashboardSelectedProjectId(input.workbench), workspaces);
  if (!resource) return undefined;

  return openWorkspacesPage(input.workbench, resource);
};

export const openSelectedWorkspace = (
  input: Pick<WorkbenchPanelRenderInput, "workbench">,
  workspace: DashboardWorkspaceOption,
  projectId: string | undefined,
) => openWorkspacesPage(input.workbench, createDashboardWorkspaceOptionResource(workspace, projectId));

const nonEmptyHarnessParams = (params: HarnessParamValues) => (Object.keys(params).length > 0 ? params : undefined);

export const DashboardSessionChatPanel = (props: DashboardSessionChatPanelProps) => {
  const { input, view, emptyStateTitle, emptyStateDescription, workspaceAction, drafts, history } = props;
  const attachedResources = [view.workspaceTitle, view.workspaceShorthand].filter(Boolean);
  const sessionId = view.sessionId ?? null;
  const projectId = useWorkbenchStore(input.workbench.context.store, (state) => {
    const value = state.values[dashboardSelectedProjectIdContextKey];
    return typeof value === "string" ? value : undefined;
  });

  const { messages, loading, streaming, reconnect, refreshQueue, error, queueError } = history;
  const createSession = useCreateProjectSession();
  const followUp = useFollowUpSession();
  const stopSession = useStopSession();

  const {
    selectedAgent,
    setSelectedAgent,
    selectedModel,
    setSelectedModel,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    harnessParamOverrides,
    setHarnessParamOverrides,
  } = useSessionModelSelection(view, projectId);
  const draftAttachments = useSessionDraftAttachments(projectId, view.draftKey, drafts);
  const { data: agents = [] } = useAgents(projectId);
  const canSubmit = canSubmitSessionMessage({
    agentOptions: agents.map((agent) => ({ value: agent.id, disabled: agent.availability.type === "NOT_FOUND" })),
    selectedAgent,
    selectedModel,
  });
  const chatDraft = useSessionChatDraft(drafts, view.draftKey);
  const openCreatedSession = (createdSessionId: string, prompt: string) => {
    if (projectId)
      openCreatedSessionFromDraft({ input, draftKey: view.draftKey, sessionId: createdSessionId, prompt, projectId });
  };
  const commandDraft = projectId
    ? {
        project_id: projectId,
        agent: selectedAgent,
        workspace_id: selectedWorkspaceId || undefined,
        model: selectedModel || undefined,
        params: nonEmptyHarnessParams(harnessParamOverrides),
      }
    : undefined;
  const commandComposer = useCommandComposer(
    sessionId,
    selectedAgent,
    chatDraft,
    reconnect,
    view.status,
    view.lastRequestStarted,
    commandDraft,
    (operation) => createDraftCommandSession(commandDraft, operation),
    openCreatedSession,
  );
  const { pendingFollowUp, displayedMessages, streamingStartedAt, pendingWork } = usePendingSessionFollowUp(
    view.draftKey,
    messages,
    view.lastRequestStarted,
    view.status === "in_progress",
  );
  const openWorkspaceOnSelection = input.panel.region !== "side";

  const splitDisplay = splitQueuedFollowUps(displayedMessages, sessionId);
  const chatMessages = useApiFileParts(splitDisplay.messages);
  const effectiveStreaming = streaming || view.status === "in_progress" || pendingWork;
  const canInterrupt = Boolean(sessionId) && effectiveStreaming && !stopSession.isPending;

  const send = (
    text: string,
    attachments: SessionAttachment[],
    questionResponse: ChatInputQuestionResponse | undefined,
    onSubmitted?: () => void,
  ) => {
    const command = commandComposer.submit(text, attachments, questionResponse, onSubmitted);
    if (command) return command;
    return submitSessionMessage({
      conversationKey: view.draftKey,
      sessionId,
      lastRequestStarted: view.lastRequestStarted,
      projectId,
      agent: selectedAgent || null,
      model: selectedModel || undefined,
      params: nonEmptyHarnessParams(harnessParamOverrides),
      workspaceId: selectedWorkspaceId || undefined,
      text,
      attachments,
      questionResponse,
      messages,
      createSession,
      followUp,
      reconnect,
      onSubmitted,
      onSessionCreated: (createdSessionId) => openCreatedSession(createdSessionId, text),
    });
  };
  const unsent = pendingFollowUp?.failure ? pendingFollowUp : null;

  const { handleQueuedFollowUpUpdate, handleQueuedFollowUpRemove, handleQueuedFollowUpMove } = useQueuedSessionMessages(
    { sessionId, queuedFollowUps: splitDisplay.queuedFollowUps, refreshQueue },
  );

  const decision = commandComposer.decision && {
    ...commandComposer.decision,
    controls: commandComposer.controls,
  };
  const submit = sessionDraftSubmission(send, draftAttachments.attachments, () => {
    chatDraft.change("");
    draftAttachments.clearSubmittedAttachments();
  });

  return (
    // The widget host sizes itself to its content, so the chat panel is pinned
    // to the region bounds and scrolls its messages internally instead of growing.
    <Box position="relative" h="full" w="full">
      <Box position="absolute" inset="0" overflow="hidden" display="flex" flexDirection="column">
        <Box flex="1" minH="0" overflow="hidden">
          <ChatPanel
            // Keying on the session id gives each session its own draft and scroll
            // state, so switching sessions in the bubble is a real switch.
            conversationKey={`dashboard-workbench-session:${view.id}`}
            messages={chatMessages}
            conversationNotices={
              <>
                {commandComposer.notices}
                <SessionChatNotices
                  error={error}
                  queueError={queueError}
                  reconnect={reconnect}
                  refreshQueue={refreshQueue}
                  unsent={
                    unsent?.failure
                      ? {
                          notice: unsent.failure,
                          ...sessionUnsentActions(unsent, {
                            clear: () => updatePendingFollowUp(view.draftKey, null),
                            send,
                            restore: (text, attachments) => {
                              chatDraft.change(text);
                              draftAttachments.restoreAttachments(attachments);
                            },
                          }),
                        }
                      : undefined
                  }
                />
              </>
            }
            queuedFollowUps={splitDisplay.queuedFollowUps}
            onQueuedFollowUpUpdate={sessionId ? handleQueuedFollowUpUpdate : undefined}
            onQueuedFollowUpRemove={sessionId ? handleQueuedFollowUpRemove : undefined}
            onQueuedFollowUpMove={sessionId ? handleQueuedFollowUpMove : undefined}
            loading={loading}
            streaming={effectiveStreaming}
            streamingStartedAt={streamingStartedAt}
            emptyStateTitle={emptyStateTitle}
            emptyStateDescription={emptyStateDescription}
            loaderComponent={<ChatSkeleton />}
            chatInputPlaceholder="Reply to the agent..."
            chatInputDefaultValue={chatDraft.text}
            onChatInputChange={chatDraft.change}
            chatInputCommands={commandComposer.suggestions}
            composerDecision={decision}
            attachedResources={attachedResources}
            attachmentActions={
              <SessionAttachmentControls
                projectId={projectId}
                uploading={draftAttachments.uploading}
                onAttachFiles={(files) => void draftAttachments.uploadFiles(files)}
              />
            }
            actions={
              <SessionComposerActions
                projectId={projectId}
                view={view}
                selectedAgent={selectedAgent}
                setSelectedAgent={setSelectedAgent}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                harnessParamOverrides={harnessParamOverrides}
                setHarnessParamOverrides={setHarnessParamOverrides}
              >
                {commandComposer.controls}
              </SessionComposerActions>
            }
            attachmentList={
              draftAttachments.attachments.length > 0 ? (
                <SessionAttachmentList
                  attachments={draftAttachments.attachments}
                  onRemove={draftAttachments.removeAttachment}
                />
              ) : undefined
            }
            onAttachFiles={projectId ? (files) => void draftAttachments.uploadFiles(files) : undefined}
            onAttachText={projectId ? (text) => void draftAttachments.uploadText(text) : undefined}
            inputDisabled={draftAttachments.uploading}
            submitDisabled={!canSubmit}
            workspaceHub={
              <SessionChatWorkspaceHub
                view={view}
                projectId={projectId}
                selectedWorkspaceId={selectedWorkspaceId}
                setSelectedWorkspaceId={setSelectedWorkspaceId}
                onSelectWorkspace={
                  openWorkspaceOnSelection
                    ? (workspace) => void openSelectedWorkspace(input, workspace, projectId)
                    : undefined
                }
                additions={view.additions}
                deletions={view.deletions}
                action={workspaceAction}
              />
            }
            onSubmitMessage={submit}
            onInterrupt={sessionId && canInterrupt ? () => stopSession.mutate(sessionId) : undefined}
          />
        </Box>
      </Box>
    </Box>
  );
};

export const ReviewChangesAction = (props: { input: WorkbenchPanelRenderInput; view: SessionWorkspaceReviewView }) => {
  const { input, view } = props;

  return (
    <Tooltip content="Open workspace">
      <IconButton
        size="xs"
        variant="ghost"
        aria-label="Open workspace"
        onClick={() => void openReviewWorkspace(input, view)}
      >
        <ArrowUpRight size={14} />
      </IconButton>
    </Tooltip>
  );
};
