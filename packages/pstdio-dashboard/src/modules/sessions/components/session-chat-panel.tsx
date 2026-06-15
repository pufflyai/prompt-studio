import { Box, Button } from "@chakra-ui/react";
import { ChatPanel, ChatSkeleton, ChatWorkspaceHub } from "@pstdio/ui/chat-ui";
import type { WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import { useWorkbenchStore } from "pstdio-workbench/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { dashboardSelectedProjectIdContextKey, getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { createDashboardResource } from "@/shared/app/resources";
import { readRecentHarnessSelection } from "@/shared/command-params/recent-harness-param";
import {
  createDashboardWorkspaceOptionResource,
  type DashboardWorkspaceOption,
} from "@/shared/workspaces/workspace-options";
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
import { useStopSession } from "../hooks/use-stop-session";
import { resolveSessionSelectionSync } from "../runtime/session-runtime-selection";
import { SessionRuntimeControls } from "./session-runtime-controls";

interface DashboardSessionChatPanelProps {
  input: WorkbenchWidgetRenderInput;
  view: DashboardSessionView;
  emptyStateTitle: string;
  emptyStateDescription: string;
  workspaceAction: ReactNode;
  showWorkspaceHub: boolean;
}

type SessionWorkspaceReviewView = Pick<
  DashboardSessionView,
  "workspaceBranch" | "workspaceId" | "workspaceShorthand" | "workspaceTitle"
>;

const createSessionWorkspaceResource = (view: SessionWorkspaceReviewView, projectId: string | undefined) => {
  if (!view.workspaceId) return undefined;

  return createDashboardResource(
    "workspace",
    view.workspaceId,
    view.workspaceTitle || view.workspaceShorthand || "Workspace",
    "GitBranch",
    projectId,
    {
      workspaceId: view.workspaceId,
      ...(view.workspaceBranch ? { workspaceBranch: view.workspaceBranch } : {}),
      ...(view.workspaceShorthand ? { workspaceShorthand: view.workspaceShorthand } : {}),
    },
  );
};

export const openReviewWorkspace = (
  input: Pick<WorkbenchWidgetRenderInput, "workbench">,
  view: SessionWorkspaceReviewView,
) => {
  const resource = createSessionWorkspaceResource(view, getDashboardSelectedProjectId(input.workbench));
  if (!resource) return undefined;

  return input.workbench.resources.openResource(resource, { replaceActive: true });
};

export const openSelectedWorkspace = (
  input: Pick<WorkbenchWidgetRenderInput, "workbench">,
  workspace: DashboardWorkspaceOption,
  projectId: string | undefined,
) =>
  input.workbench.resources.openResource(createDashboardWorkspaceOptionResource(workspace, projectId), {
    replaceActive: true,
  });

export const DashboardSessionChatPanel = (props: DashboardSessionChatPanelProps) => {
  const { input, view, emptyStateTitle, emptyStateDescription, workspaceAction, showWorkspaceHub } = props;
  const attachedResources = [view.workspaceTitle, view.workspaceShorthand].filter(Boolean);
  const sessionId = view.sessionId ?? null;
  const projectId = useWorkbenchStore(input.workbench.context.store, (state) => {
    const value = state.values[dashboardSelectedProjectIdContextKey];
    return typeof value === "string" ? value : undefined;
  });

  const { messages, loading, streaming, reconnect } = useDashboardSessionMessages(view.sessionId);
  const createSession = useCreateProjectSession();
  const followUp = useFollowUpSession();
  const stopSession = useStopSession();

  // Drafts start from the project's last explicit selection instead of the defaults.
  const [recent] = useState(() => (view.sessionId ? undefined : readRecentHarnessSelection(projectId)));
  const [selectedAgent, setSelectedAgent] = useState(view.agent ?? recent?.harnessId ?? "");
  const [selectedModel, setSelectedModel] = useState(view.lastSelectedModel ?? recent?.model ?? "");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(view.workspaceId ?? "");
  const [pendingFollowUp, setPendingFollowUp] = useState<PendingFollowUpState | null>(null);
  const pendingIdRef = useRef(0);
  const previousViewRef = useRef(view);
  const openWorkspaceOnSelection = input.widget.area !== "floating";

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

  const displayedMessages = mergeMessagesWithPendingFollowUp(
    messages,
    shouldShowPendingFollowUp(pendingFollowUp, sessionId) ? pendingFollowUp : null,
  );
  const effectiveStreaming = streaming || Boolean(pendingFollowUp);
  const canInterrupt = Boolean(sessionId) && effectiveStreaming && !stopSession.isPending;

  return (
    // The widget host sizes itself to its content, so the chat panel is pinned
    // to the area bounds and scrolls its messages internally instead of growing.
    <Box position="relative" h="full" w="full">
      <Box position="absolute" inset="0" overflow="hidden">
        <ChatPanel
          // Keying on the session id gives each session its own draft and scroll
          // state, so switching sessions in the bubble is a real switch.
          conversationKey={`dashboard-workbench-session:${view.id}`}
          messages={displayedMessages}
          loading={loading}
          streaming={effectiveStreaming}
          emptyStateTitle={emptyStateTitle}
          emptyStateDescription={emptyStateDescription}
          loaderComponent={<ChatSkeleton />}
          chatInputPlaceholder="Reply to the agent..."
          attachedResources={attachedResources}
          workspaceHub={
            showWorkspaceHub ? (
              <ChatWorkspaceHub
                changesLabel={view.workspaceShorthand}
                additions={view.additions}
                deletions={view.deletions}
                action={workspaceAction}
              />
            ) : undefined
          }
          repoMenu={
            <SessionRuntimeControls
              view={view}
              projectId={projectId}
              selectedAgent={selectedAgent}
              setSelectedAgent={setSelectedAgent}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              selectedWorkspaceId={selectedWorkspaceId}
              setSelectedWorkspaceId={setSelectedWorkspaceId}
              onSelectWorkspace={
                openWorkspaceOnSelection
                  ? (workspace) => void openSelectedWorkspace(input, workspace, projectId)
                  : undefined
              }
            />
          }
          onSubmitMessage={(text, _attachments, questionResponse) =>
            submitSessionMessage({
              sessionId,
              projectId,
              agent: selectedAgent || null,
              model: selectedModel || undefined,
              workspaceId: selectedWorkspaceId || undefined,
              text,
              questionResponse,
              messages,
              pendingIdRef,
              setPendingFollowUp,
              createSession,
              followUp,
              reconnect,
              onSessionCreated: (sessionId) => {
                if (!projectId) return;
                openCreatedSessionFromDraft({ input, sessionId, prompt: text, projectId });
              },
            })
          }
          onInterrupt={sessionId && canInterrupt ? () => stopSession.mutate(sessionId) : undefined}
        />
      </Box>
    </Box>
  );
};

export const ReviewChangesAction = (props: { input: WorkbenchWidgetRenderInput; view: SessionWorkspaceReviewView }) => {
  const { input, view } = props;

  return (
    <Button size="sm" variant="plain" onClick={() => void openReviewWorkspace(input, view)}>
      Review changes
    </Button>
  );
};
