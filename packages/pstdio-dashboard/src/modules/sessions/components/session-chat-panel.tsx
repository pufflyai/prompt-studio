import { Box } from "@chakra-ui/react";
import { type ChatInputQuestionResponse, ChatSkeleton } from "@pstdio/ui/chat-ui";
import type { HarnessParamValues } from "@pstdio/ui/param-editor";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useWorkbenchStore } from "@pstdio/workbench/react";
import type { Session, SessionAttachment } from "pstdio-api-contracts";
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
import { openCreatedSessionFromDraft, submitSessionMessage } from "../chat/session-chat-actions";
import { sessionDraftSubmission } from "../chat/session-draft-submission";
import type { SessionViewContext } from "../chat/session-view-context";
import type { DashboardSessionView } from "../data/dashboard-sessions";
import { useCreateProjectSession } from "../hooks/use-create-project-session";
import type { useDashboardSessionMessages } from "../hooks/use-dashboard-session-messages";
import { useFollowUpSession } from "../hooks/use-follow-up-session";
import { useSessionDevice } from "../hooks/use-session-device";
import { useStopSession } from "../hooks/use-stop-session";
import { SessionChatFeedback } from "./session-chat-feedback";
import { useSessionLinks } from "./session-chat-links";
import { SessionChatWorkspaceHub } from "./session-chat-workspace-hub";
import { SessionMessageForkPanel } from "./session-message-fork-panel";
import { useCommandComposer } from "./use-command-composer";
import { usePendingSessionFollowUp } from "./use-pending-session-follow-up";
import { useSessionChatDraft } from "./use-session-chat-draft";
import { useSessionDraftAttachments } from "./use-session-draft-attachments";
import { useSessionHarness } from "./use-session-harness";
import { useSessionModelSelection } from "./use-session-model-selection";

interface DashboardSessionChatPanelProps {
  conversationKey?: string;
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

const commandSessionDraft = (
  projectId: string | undefined,
  agent: string,
  workspace: string,
  model: string,
  params: HarnessParamValues,
) =>
  projectId
    ? {
        project_id: projectId,
        agent,
        workspace_id: workspace || undefined,
        model: model || undefined,
        params: nonEmptyHarnessParams(params),
      }
    : undefined;

const composerDecision = (composer: ReturnType<typeof useCommandComposer>) =>
  composer.decision && { ...composer.decision, controls: composer.controls };

const deviceSendError = (device: ReturnType<typeof useSessionDevice>, questionResponse?: ChatInputQuestionResponse) => {
  if (device.connectionUnknown) return new Error(`Check the connection to ${device.name} before sending.`);
  if (device.offline) return new Error(`${device.name} is offline. Reconnect it before sending.`);
  if (device.unavailable && !questionResponse) return new Error(`Refresh the queue on ${device.name} before sending.`);
};

const unavailableDevice = (device: ReturnType<typeof useSessionDevice>, owner: Session["device"]) =>
  device.connectionUnavailable ? { id: device.deviceId!, name: device.name, ownerId: owner?.ownerId ?? "" } : undefined;

const useSelectedProjectId = (input: SessionViewContext) =>
  useWorkbenchStore(input.workbench.context.store, (state) => {
    const value = state.values[dashboardSelectedProjectIdContextKey];
    return typeof value === "string" ? value : undefined;
  });

export const DashboardSessionChatPanel = (props: DashboardSessionChatPanelProps) => {
  const { input, view, conversationKey, emptyStateTitle, emptyStateDescription, drafts, history } = props;
  const sessionId = view.sessionId ?? null;
  const device = useSessionDevice(view.device, history.queue?.readOnly, history.refreshQueue);
  const projectId = useSelectedProjectId(input);
  const links = useSessionLinks(input.workbench, projectId, view.workspaceId);

  const { messages, loading, streaming, reconnect, refreshQueue, queue } = history;
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
  const commandDraft = commandSessionDraft(
    projectId,
    selectedAgent,
    selectedWorkspaceId,
    selectedModel,
    harnessParamOverrides,
  );
  const commandComposer = useCommandComposer(
    sessionId,
    // Another device's harness commands exist only on that device; asking here only fails.
    device.remote ? "" : selectedAgent,
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
  const splitDisplay = splitQueuedFollowUps(displayedMessages, sessionId, queue, pendingFollowUp);
  const chatMessages = useApiFileParts(splitDisplay.messages);
  const effectiveStreaming = streaming || view.status === "in_progress" || pendingWork;
  const canInterrupt = Boolean(sessionId) && effectiveStreaming && !stopSession.isPending;
  const interrupt =
    sessionId && canInterrupt && !device.connectionUnavailable ? () => stopSession.mutate(sessionId) : undefined;
  const { account, canSubmit, noHarnessAvailable, needsLogin, setup, commands, submitAccountCommand } =
    useSessionHarness({
      input,
      projectId,
      selectedAgent,
      selectedModel,
      otherDevice: device.remote,
      onInterrupt: interrupt,
    });

  const send = (
    text: string,
    attachments: SessionAttachment[],
    questionResponse: ChatInputQuestionResponse | undefined,
    onSubmitted?: () => void,
  ) => {
    const deviceError = deviceSendError(device, questionResponse);
    if (deviceError) return Promise.reject(deviceError);
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
      deviceId: device.deviceId,
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

  const submit = sessionDraftSubmission(send, draftAttachments.attachments, () => {
    chatDraft.change("");
    draftAttachments.clearSubmittedAttachments();
  });

  return (
    // The widget host sizes itself to its content, so the chat panel is pinned
    // to the region bounds and scrolls its messages internally instead of growing.
    <Box position="relative" h="full" w="full">
      <Box position="absolute" inset="0" overflow="hidden">
        <SessionMessageForkPanel
          forkContext={props}
          // Keying on the session id gives each session its own draft and scroll
          // state, so switching sessions in the bubble is a real switch.
          conversationKey={`dashboard-workbench-session:${conversationKey ?? view.id}`}
          messages={chatMessages}
          linkHandler={links.handler}
          conversationNotices={
            <SessionChatFeedback
              sessionId={sessionId}
              unavailable={device.connectionUnavailable}
              queueReadOnlyDevice={device.unavailable && !device.connectionUnavailable ? device.name : undefined}
              history={history}
              interrupt={stopSession}
              pending={pendingFollowUp}
              draftKey={view.draftKey}
              send={send}
              restore={(text, attachments) => {
                chatDraft.change(text);
                draftAttachments.restoreAttachments(attachments);
              }}
            >
              {commandComposer.notices}
              {account.notice}
              {chatMessages.length > 0 ? setup : null}
              {links.notice}
            </SessionChatFeedback>
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
          chatInputAutoFocus={!view.sessionId}
          chatInputDefaultValue={chatDraft.text}
          onChatInputChange={chatDraft.change}
          chatInputCommands={commands(commandComposer.suggestions)}
          composerDecision={composerDecision(commandComposer)}
          device={unavailableDevice(device, view.device)}
          connectionUnknown={device.connectionUnknown}
          remote={device.remote}
          onDeviceReconnect={device.refresh}
          attachedResources={[view.workspaceTitle, view.workspaceShorthand].filter(Boolean)}
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
            remote: device.remote,
            selectedAgent,
            setSelectedAgent,
            selectedModel,
            setSelectedModel,
            harnessParamOverrides,
            setHarnessParamOverrides,
            children: commandComposer.controls,
          }}
          submitDisabled={device.unavailable || (!canSubmit && !account.isCommand(chatDraft.text))}
          messagesBlocked={needsLogin || noHarnessAvailable || account.checking || Boolean(account.progress)}
          inputDisabled={device.connectionUnavailable}
          workspaceHub={
            <SessionChatWorkspaceHub
              view={view}
              device={device}
              projectId={projectId}
              selectedWorkspaceId={selectedWorkspaceId}
              setSelectedWorkspaceId={setSelectedWorkspaceId}
              onSelectWorkspace={
                input.region !== "side"
                  ? (workspace) => void openSelectedWorkspace(input, workspace, projectId)
                  : undefined
              }
              additions={view.additions}
              deletions={view.deletions}
              onOpenWorkspace={(workspace) => void openSelectedWorkspace(input, workspace, projectId)}
            />
          }
          onSubmitMessage={device.connectionUnavailable ? undefined : submit}
          onInterrupt={interrupt}
        />
      </Box>
    </Box>
  );
};
