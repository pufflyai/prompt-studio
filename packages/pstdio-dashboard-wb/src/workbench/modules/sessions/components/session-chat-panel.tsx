import { Box, Button } from "@chakra-ui/react";
import { ChatPanel, ChatSkeleton, ChatWorkspaceHub } from "@pstdio/ui/chat-ui";
import type { WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import type { ReactNode } from "react";
import type { DashboardSessionView } from "../../../data/dashboard-data";
import { useDashboardSessionMessages } from "../use-dashboard-session-messages";
import { SessionRuntimeControls } from "./session-runtime-controls";

interface DashboardSessionChatPanelProps {
  input: WorkbenchWidgetRenderInput;
  view: DashboardSessionView;
  emptyStateTitle: string;
  emptyStateDescription: string;
  workspaceAction: ReactNode;
}

export const DashboardSessionChatPanel = (props: DashboardSessionChatPanelProps) => {
  const { input, view, emptyStateTitle, emptyStateDescription, workspaceAction } = props;
  const attachedResources = [view.workspaceTitle, view.workspaceShorthand].filter(Boolean);
  const { messages, loading, streaming } = useDashboardSessionMessages(view.sessionId);

  return (
    // The widget host sizes itself to its content, so the chat panel is pinned
    // to the area bounds and scrolls its messages internally instead of growing.
    <Box position="relative" h="full" w="full">
      <Box position="absolute" inset="0" overflow="hidden">
        <ChatPanel
          // Keying on the session id gives each session its own draft and scroll
          // state, so switching sessions in the bubble is a real switch.
          conversationKey={`dashboard-workbench-session:${view.id}`}
          messages={messages}
          loading={loading}
          streaming={streaming}
          emptyStateTitle={emptyStateTitle}
          emptyStateDescription={emptyStateDescription}
          loaderComponent={<ChatSkeleton />}
          chatInputPlaceholder="Reply to the agent..."
          attachedResources={attachedResources}
          workspaceHub={
            <ChatWorkspaceHub
              changesLabel={view.workspaceShorthand}
              additions={view.additions}
              deletions={view.deletions}
              action={workspaceAction}
            />
          }
          repoMenu={<SessionRuntimeControls input={input} view={view} />}
          onSubmitMessage={(text) =>
            input.workbench.notifications.show({ level: "success", title: `Message queued: ${text}` })
          }
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
