import { Box, IconButton } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { ChatPanel, ChatSkeleton, ChatWorkspaceHub } from "@pstdio/ui/chat-ui";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useWorkbenchStore } from "@pstdio/workbench/react";
import { ArrowUpRight } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useAgents } from "@/shared/agents/use-agents";
import { dashboardSelectedProjectIdContextKey, getDashboardSelectedProjectId } from "@/shared/app/project-context";
import type { DashboardSessionDraftPersistence } from "@/shared/app/session-draft-persistence";
import { readRecentHarnessSelection } from "@/shared/command-params/recent-harness-param";
import { openWorkspacesPage } from "@/shared/workbench/page-navigation";
import {
  createDashboardWorkspaceOptionResource,
  createDashboardWorkspaceOptions,
  type DashboardWorkspaceOption,
} from "@/shared/workspaces/workspace-options";
import { splitQueuedFollowUps } from "../chat/queued-follow-ups";
import { openCreatedSessionFromDraft, submitSessionMessage } from "../chat/session-chat-actions";
import {
  mergeMessagesWithPendingFollowUp,
  type PendingFollowUpState,
  shouldShowPendingFollowUp,
} from "../chat/session-chat-state";
import { type DashboardSessionView, draftSessionViewId } from "../data/dashboard-sessions";
import { useCreateProjectSession } from "../hooks/use-create-project-session";
import { useDashboardSessionMessages } from "../hooks/use-dashboard-session-messages";
import { useFollowUpSession } from "../hooks/use-follow-up-session";
import { useQueuedSessionMessages } from "../hooks/use-queued-session-messages";
import { useStopSession } from "../hooks/use-stop-session";
import { canSubmitSessionMessage, resolveSessionSelectionSync } from "../runtime/session-runtime-selection";
import type { HarnessParamValues } from "./harness-param-values";
import { SessionAttachmentControls } from "./session-attachment-controls";
import { SessionAttachmentList } from "./session-attachment-list";
import { SessionChatNotices } from "./session-chat-notices";
import { SessionModelControls } from "./session-model-controls";
import { SessionWorkspaceControl } from "./session-workspace-control";
import { useSessionChatDraft } from "./use-session-chat-draft";
import { useSessionDraftAttachments } from "./use-session-draft-attachments";

interface DashboardSessionChatPanelProps {
  input: WorkbenchPanelRenderInput;
  view: DashboardSessionView;
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
  const { input, view, emptyStateTitle, emptyStateDescription, workspaceAction, drafts } = props;
  const attachedResources = [view.workspaceTitle, view.workspaceShorthand].filter(Boolean);
  const sessionId = view.sessionId ?? null;
  const projectId = useWorkbenchStore(input.workbench.context.store, (state) => {
    const value = state.values[dashboardSelectedProjectIdContextKey];
    return typeof value === "string" ? value : undefined;
  });

  const { messages, loading, streaming, reconnect, refreshQueue, retryHistory, historyIssue, error, queueError } =
    useDashboardSessionMessages(input, view.sessionId);
  const historyReadOnly = Boolean(historyIssue && historyIssue.code !== "native_unavailable");
  const createSession = useCreateProjectSession();
  const followUp = useFollowUpSession();
  const stopSession = useStopSession();

  // Drafts start from the project's last explicit selection instead of the defaults.
  const [recent] = useState(() => (view.sessionId ? undefined : readRecentHarnessSelection(projectId)));
  const [selectedAgent, setSelectedAgent] = useState(view.agent ?? recent?.harnessId ?? "");
  const [selectedModel, setSelectedModel] = useState(view.lastSelectedModel ?? recent?.model ?? "");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(view.workspaceId ?? "");
  const [harnessParamOverrides, setHarnessParamOverrides] = useState<HarnessParamValues>({});
  const draftAttachments = useSessionDraftAttachments(projectId);
  const { data: agents = [] } = useAgents(projectId);
  const canSubmit = canSubmitSessionMessage({
    agentOptions: agents.map((agent) => ({ value: agent.id, disabled: agent.availability.type === "NOT_FOUND" })),
    selectedAgent,
    selectedModel,
  });
  const chatDraft = useSessionChatDraft(drafts, view.draftKey);
  const [pendingFollowUp, setPendingFollowUp] = useState<PendingFollowUpState | null>(null);
  const pendingIdRef = useRef(0);
  const previousSelectedAgentRef = useRef(selectedAgent);
  const previousViewRef = useRef(view);
  const openWorkspaceOnSelection = input.panel.region !== "side";

  useEffect(() => {
    const previous = previousViewRef.current;
    previousViewRef.current = view;

    const updates = resolveSessionSelectionSync({
      isViewSwitch: previous.id !== view.id,
      isPreviousViewDraft: previous.id === draftSessionViewId,
      previous,
      view,
    });
    if (updates.agent !== undefined) setSelectedAgent(updates.agent);
    if (updates.model !== undefined) setSelectedModel(updates.model);
    if (updates.workspaceId !== undefined) setSelectedWorkspaceId(updates.workspaceId);
  }, [view]);

  useEffect(() => {
    if (!pendingFollowUp) return;
    if (messages.length > pendingFollowUp.messageCount) setPendingFollowUp(null);
  }, [messages, pendingFollowUp]);

  useEffect(() => {
    if (previousSelectedAgentRef.current === selectedAgent) return;
    previousSelectedAgentRef.current = selectedAgent;
    setHarnessParamOverrides({});
  }, [selectedAgent]);

  const displayedMessages = mergeMessagesWithPendingFollowUp(
    messages,
    shouldShowPendingFollowUp(pendingFollowUp, sessionId) ? pendingFollowUp : null,
  );
  const splitDisplay = splitQueuedFollowUps(displayedMessages, sessionId);
  const effectiveStreaming = streaming || view.status === "in_progress" || Boolean(pendingFollowUp);
  const canInterrupt = Boolean(sessionId) && effectiveStreaming && !stopSession.isPending;

  const { handleQueuedFollowUpUpdate, handleQueuedFollowUpRemove, handleQueuedFollowUpMove } = useQueuedSessionMessages(
    { sessionId, queuedFollowUps: splitDisplay.queuedFollowUps, refreshQueue },
  );

  return (
    // The widget host sizes itself to its content, so the chat panel is pinned
    // to the region bounds and scrolls its messages internally instead of growing.
    <Box position="relative" h="full" w="full">
      <Box position="absolute" inset="0" overflow="hidden" display="flex" flexDirection="column">
        <SessionChatNotices
          input={input}
          sessionId={sessionId}
          historyIssue={historyIssue}
          error={error}
          queueError={queueError}
          retryHistory={retryHistory}
          refreshQueue={refreshQueue}
        />
        <Box flex="1" minH="0" overflow="hidden">
          <ChatPanel
            // Keying on the session id gives each session its own draft and scroll
            // state, so switching sessions in the bubble is a real switch.
            conversationKey={`dashboard-workbench-session:${view.id}`}
            messages={splitDisplay.messages}
            queuedFollowUps={splitDisplay.queuedFollowUps}
            onQueuedFollowUpUpdate={sessionId ? handleQueuedFollowUpUpdate : undefined}
            onQueuedFollowUpRemove={sessionId ? handleQueuedFollowUpRemove : undefined}
            onQueuedFollowUpMove={sessionId ? handleQueuedFollowUpMove : undefined}
            loading={loading}
            streaming={effectiveStreaming}
            emptyStateTitle={emptyStateTitle}
            emptyStateDescription={emptyStateDescription}
            loaderComponent={<ChatSkeleton />}
            chatInputPlaceholder="Reply to the agent..."
            chatInputDefaultValue={chatDraft.seed}
            onChatInputChange={chatDraft.change}
            attachedResources={attachedResources}
            actions={
              <>
                <SessionAttachmentControls
                  projectId={projectId}
                  uploading={draftAttachments.uploading}
                  onAttachFiles={(files) => void draftAttachments.uploadFiles(files)}
                />
                <SessionModelControls
                  view={view}
                  projectId={projectId}
                  selectedAgent={selectedAgent}
                  setSelectedAgent={setSelectedAgent}
                  selectedModel={selectedModel}
                  setSelectedModel={setSelectedModel}
                  harnessParamOverrides={harnessParamOverrides}
                  setHarnessParamOverrides={setHarnessParamOverrides}
                />
              </>
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
            inputDisabled={draftAttachments.uploading || historyReadOnly}
            submitDisabled={!canSubmit || historyReadOnly}
            workspaceHub={
              <ChatWorkspaceHub
                workspaceControl={
                  <SessionWorkspaceControl
                    view={view}
                    projectId={projectId}
                    selectedWorkspaceId={selectedWorkspaceId}
                    setSelectedWorkspaceId={setSelectedWorkspaceId}
                    onSelectWorkspace={
                      openWorkspaceOnSelection
                        ? (workspace) => void openSelectedWorkspace(input, workspace, projectId)
                        : undefined
                    }
                  />
                }
                additions={view.additions}
                deletions={view.deletions}
                action={workspaceAction}
              />
            }
            onSubmitMessage={(text, _attachments, questionResponse) => {
              if (historyReadOnly) return;
              const submittedAttachments = draftAttachments.attachments;
              return submitSessionMessage({
                sessionId,
                projectId,
                agent: selectedAgent || null,
                model: selectedModel || undefined,
                params: nonEmptyHarnessParams(harnessParamOverrides),
                workspaceId: selectedWorkspaceId || undefined,
                text,
                attachments: submittedAttachments,
                questionResponse,
                messages,
                pendingIdRef,
                setPendingFollowUp,
                createSession,
                followUp,
                reconnect,
                onSubmitted: () => {
                  chatDraft.clear();
                  draftAttachments.clearSubmittedAttachments();
                },
                onSessionCreated: (sessionId) => {
                  if (!projectId) return;
                  openCreatedSessionFromDraft({ input, sessionId, prompt: text, projectId });
                },
              });
            }}
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
