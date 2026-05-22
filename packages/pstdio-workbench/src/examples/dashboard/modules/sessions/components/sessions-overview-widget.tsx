import { Box, Button } from "@chakra-ui/react";
import { ChatPanel, ChatWorkspaceHub } from "@pstdio/ui/chat-ui";
import type { WorkbenchWidgetRenderInput } from "../../../../../react";
import { dashboardTickets } from "../../../shared/mock-data/tickets";
import { dashboardMockChatMessages } from "../mock-data/sessions";

export const SessionsOverviewWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;

  return (
    <Box h="full" minH="0">
      <ChatPanel
        conversationKey="dashboard-workbench-sessions"
        messages={dashboardMockChatMessages}
        streaming
        emptyStateTitle="No sessions"
        emptyStateDescription="Start a workspace session from a ticket."
        chatInputPlaceholder="Message this session..."
        attachedResources={["PS-294", "Attempt A1"]}
        workspaceHub={
          <ChatWorkspaceHub
            changesLabel="Attempt A1"
            additions={148}
            deletions={37}
            action={
              <Button
                size="2xs"
                variant="ghost"
                onClick={() => {
                  void input.workbench.resources.openResource(dashboardTickets[0].workspaceResource, {
                    replaceActive: true,
                  });
                }}
              >
                Open workspace
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
