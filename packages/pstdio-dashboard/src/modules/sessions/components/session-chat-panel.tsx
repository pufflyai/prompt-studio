import { Box } from "@chakra-ui/react";
import { type ChatInputQuestionResponse, ChatSkeleton } from "@pstdio/ui/chat-ui";
import type { HarnessParamValues } from "@pstdio/ui/param-editor";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useWorkbenchStore } from "@pstdio/workbench/react";
import type { SessionAttachment } from "pstdio-api-contracts";
import { useApiFileParts } from "@/lib/api-file-url";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardSelectedProjectIdContextKey } from "@/shared/app/project-context";
import type { DashboardSessionDraftPersistence } from "@/shared/app/session-draft-persistence";
import { openWorkspacesPage } from "@/shared/workbench/page-navigation";
import {
  createDashboardWorkspaceOptionResource,
  type DashboardWorkspaceOption,
} from "@/shared/workspaces/workspace-options";
import { createDraftCommandSession } from "../chat/create-draft-command-session";
import { splitQueuedFollowUps } from "../chat/queued-follow-ups";
import { clearPendingFollowUp, openCreatedSessionFromDraft, submitSessionMessage } from "../chat/session-chat-actions";
import { sessionDraftSubmission } from "../chat/session-draft-submission";
import { sessionUnsentActions } from "../chat/session-unsent-actions";
import type { SessionViewContext } from "../chat/session-view-context";
import type { DashboardSessionView } from "../data/dashboard-sessions";
import { useCreateProjectSession } from "../hooks/use-create-project-session";
import type { useDashboardSessionMessages } from "../hooks/use-dashboard-session-messages";
import { useFollowUpSession } from "../hooks/use-follow-up-session";
import { useStopSession } from "../hooks/use-stop-session";
import { useSessionLinks } from "./session-chat-links";
import { SessionChatNotices } from "./session-chat-notices";
import { SessionChatWorkspaceHub } from "./session-chat-workspace-hub";
import { SessionPersonalDevice } from "./session-personal-device";
import { SessionQueuedChatPanel } from "./session-queued-chat-panel";
import { useCommandComposer } from "./use-command-composer";
import { usePendingSessionFollowUp } from "./use-pending-session-follow-up";
import { useSessionChatDraft } from "./use-session-chat-draft";
import { useSessionDraftAttachments } from "./use-session-draft-attachments";
import { useSessionHarness } from "./use-session-harness";
import { useSessionModelSelection } from "./use-session-model-selection";

interface DashboardSessionChatPanelProps {
  input: SessionViewContext;
  view: DashboardSessionView;
  history: ReturnType<typeof useDashboardSessionMessages>;
  emptyStateTitle: string;
  emptyStateDescription: string;
  drafts?: DashboardSessionDraftPersistence;
}

export const openSelectedWorkspace = (
  input: Pick<WorkbenchPanelRenderInput, "workbench">,
  workspace: DashboardWorkspaceOption,
  projectId: string | undefined,
) => openWorkspacesPage(input.workbench, createDashboardWorkspaceOptionResource(workspace, projectId));

const nonEmptyHarnessParams = (params: HarnessParamValues) => (Object.keys(params).length > 0 ? params : undefined);

export const DashboardSessionChatPanel = (props: DashboardSessionChatPanelProps) => {
  const { input, view, emptyStateTitle, emptyStateDescription, drafts, history } = props;
  const attachedResources = [view.workspaceTitle, view.workspaceShorthand].filter(Boolean);
  const sessionId = view.sessionId ?? null;
  const projectId = useWorkbenchStore(input.workbench.context.store, (state) => {
    const value = state.values[dashboardSelectedProjectIdContextKey];
    return typeof value === "string" ? value : undefined;
  });
  const links = useSessionLinks(input.workbench, projectId, view.workspaceId);

  const { messages, loading, streaming, reconnect, refreshQueue, error, queueError, queue } = history;
  // A session that works on files asks for the project's folder on a device that does not have it yet.
  const chooseProjectFolder = () =>
    void input.workbench.commands.executeCommand(dashboardCommandIds.chooseProjectFolder);
  const createSession = useCreateProjectSession({ onFolderMissing: chooseProjectFolder });
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
  const chatDraft = useSessionChatDraft(drafts, view.draftKey);
  const openCreatedSession = (createdSessionId: string, prompt: string) => {
    if (projectId) openCreatedSessionFromDraft({ input, sessionId: createdSessionId, prompt, projectId });
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
    (operation) => createDraftCommandSession(commandDraft, operation, chooseProjectFolder),
    openCreatedSession,
    input,
  );
  const { pendingFollowUp, displayedMessages, streamingStartedAt, pendingWork } = usePendingSessionFollowUp(
    view.draftKey,
    sessionId,
    messages,
    view.lastRequestStarted,
    view.status === "in_progress",
  );
  const openWorkspaceOnSelection = input.region !== "side";

  const splitDisplay = splitQueuedFollowUps(displayedMessages, sessionId, queue, pendingFollowUp);
  const chatMessages = useApiFileParts(splitDisplay.messages);
  const effectiveStreaming = streaming || view.status === "in_progress" || pendingWork;
  const canInterrupt = Boolean(sessionId) && effectiveStreaming && !stopSession.isPending;
  const interrupt = sessionId && canInterrupt && !view.device ? () => stopSession.mutate(sessionId) : undefined;
  const { account, canSubmit, noHarnessAvailable, needsLogin, setup, commands, submitAccountCommand } =
    useSessionHarness({
      input,
      projectId,
      selectedAgent,
      selectedModel,
      otherDevice: Boolean(view.device),
      onInterrupt: interrupt,
    });

  const send = (
    text: string,
    attachments: SessionAttachment[],
    questionResponse: ChatInputQuestionResponse | undefined,
    onSubmitted?: () => void,
  ) => {
    const accountCommand = submitAccountCommand(text, () => chatDraft.change(""));
    if (accountCommand) return accountCommand;
    const command = commandComposer.submit(text, attachments, questionResponse, onSubmitted);
    if (command) return command;
    return submitSessionMessage({
      conversationKey: view.draftKey,
      sessionId,
      sessionStatus: view.status,
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
      refreshQueue,
      onSubmitted,
      onSessionCreated: (createdSessionId) => openCreatedSession(createdSessionId, text),
    });
  };

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
      <Box position="absolute" inset="0" overflow="hidden">
        <SessionQueuedChatPanel
          // Keying on the session id gives each session its own draft and scroll
          // state, so switching sessions in the bubble is a real switch.
          conversationKey={`dashboard-workbench-session:${view.id}`}
          messages={chatMessages}
          linkHandler={links.handler}
          conversationNotices={
            <>
              {commandComposer.notices}
              {account.notice}
              {chatMessages.length > 0 ? setup : null}
              {links.notice}
              <SessionChatNotices
                error={error}
                queueError={queueError}
                reconnect={reconnect}
                refreshQueue={refreshQueue}
                unsent={
                  pendingFollowUp?.failure
                    ? {
                        notice: pendingFollowUp.failure,
                        ...sessionUnsentActions(pendingFollowUp, {
                          clear: () => clearPendingFollowUp(view.draftKey, pendingFollowUp),
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
          loading={loading}
          streaming={effectiveStreaming}
          streamingStartedAt={streamingStartedAt}
          emptyStateTitle={emptyStateTitle}
          emptyStateDescription={emptyStateDescription}
          emptyStateContent={setup}
          hideComposer={noHarnessAvailable}
          loaderComponent={<ChatSkeleton />}
          chatInputPlaceholder="Reply to the agent..."
          chatInputDefaultValue={chatDraft.text}
          onChatInputChange={chatDraft.change}
          chatInputCommands={commands(commandComposer.suggestions)}
          composerDecision={decision}
          composerFallback={view.device ? <SessionPersonalDevice name={view.device.name} /> : undefined}
          attachedResources={attachedResources}
          projectId={projectId}
          sessionId={sessionId}
          draftKey={view.draftKey}
          drafts={drafts}
          queue={queue}
          refreshQueue={refreshQueue}
          draftAttachments={draftAttachments}
          modelControls={{
            projectId,
            view,
            selectedAgent,
            setSelectedAgent,
            selectedModel,
            setSelectedModel,
            harnessParamOverrides,
            setHarnessParamOverrides,
            children: commandComposer.controls,
          }}
          submitDisabled={Boolean(view.device) || (!canSubmit && !account.isCommand(chatDraft.text))}
          messagesBlocked={needsLogin || noHarnessAvailable || account.checking || Boolean(account.progress)}
          inputDisabled={Boolean(view.device)}
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
              onOpenWorkspace={(workspace) => void openSelectedWorkspace(input, workspace, projectId)}
            />
          }
          onSubmitMessage={view.device ? undefined : submit}
          onInterrupt={interrupt}
        />
      </Box>
    </Box>
  );
};
