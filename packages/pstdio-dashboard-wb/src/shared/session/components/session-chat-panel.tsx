import { Box, Button } from "@chakra-ui/react";
import { ChatPanel, ChatSkeleton, ChatWorkspaceHub } from "@pstdio/ui/chat-ui";
import type { WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import { useWorkbenchStore } from "pstdio-workbench/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { DashboardSessionView } from "../../../modules/sessions/data/dashboard-sessions";
import { dashboardSelectedProjectIdContextKey } from "../../project-context";
import { openCreatedSessionFromDraft, submitSessionMessage } from "../session-chat-actions";
import {
  mergeMessagesWithPendingFollowUp,
  type PendingFollowUpState,
  shouldShowPendingFollowUp,
} from "../session-chat-state";
import { useCreateProjectSession } from "../use-create-project-session";
import { useDashboardSessionMessages } from "../use-dashboard-session-messages";
import { useFollowUpSession } from "../use-follow-up-session";
import { useStopSession } from "../use-stop-session";
import { SessionRuntimeControls } from "./session-runtime-controls";

interface DashboardSessionChatPanelProps {
  input: WorkbenchWidgetRenderInput;
  view: DashboardSessionView;
  emptyStateTitle: string;
  emptyStateDescription: string;
  workspaceAction: ReactNode;
  showWorkspaceHub: boolean;
}

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

  const [selectedAgent, setSelectedAgent] = useState(view.agent ?? "");
  const [selectedModel, setSelectedModel] = useState(view.lastSelectedModel ?? "");
  const [pendingFollowUp, setPendingFollowUp] = useState<PendingFollowUpState | null>(null);
  const pendingIdRef = useRef(0);

  useEffect(() => {
    setSelectedAgent(view.agent ?? "");
    setSelectedModel(view.lastSelectedModel ?? "");
  }, [view.agent, view.lastSelectedModel]);

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
            />
          }
          onSubmitMessage={(text, _attachments, questionResponse) =>
            submitSessionMessage({
              sessionId,
              projectId,
              agent: selectedAgent || null,
              model: selectedModel || undefined,
              workspaceId: view.workspaceId ?? undefined,
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

export const CommandPaletteReviewAction = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;

  return (
    <Button size="sm" variant="plain" onClick={() => input.workbench.commandPalette.open()}>
      Review changes
    </Button>
  );
};
