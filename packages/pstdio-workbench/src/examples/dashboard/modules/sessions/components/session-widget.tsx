import { Box, Button } from "@chakra-ui/react";
import { ChatPanel, ChatWorkspaceHub } from "@pstdio/ui/chat-ui";
import type { WorkbenchWidgetRenderInput } from "../../../../../react";
import { dashboardMockChatMessages } from "../mock-data/sessions";

export const SessionWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;

  return (
    <Box flex="1" minH="0">
      <ChatPanel
        conversationKey="dashboard-workbench-session"
        messages={dashboardMockChatMessages}
        streaming
        emptyStateTitle="No messages yet"
        emptyStateDescription="Start the conversation."
        chatInputPlaceholder="Reply to the agent..."
        attachedResources={["PS-294", "project-shell.tsx"]}
        workspaceHub={
          <ChatWorkspaceHub
            changesLabel="Attempt A1"
            additions={148}
            deletions={37}
            action={
              <Button size="2xs" variant="ghost" onClick={() => input.workbench.commandPalette.open()}>
                Review
              </Button>
            }
          />
        }
        onSubmitMessage={(text) =>
          input.workbench.notifications.show({ level: "success", title: `Message queued: ${text}` })
        }
      />
    </Box>
  );
};
