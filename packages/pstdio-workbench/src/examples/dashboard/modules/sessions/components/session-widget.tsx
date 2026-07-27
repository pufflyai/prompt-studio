import { Box, Button, Text } from "@chakra-ui/react";
import { ChatPanel, ChatWorkspaceHub } from "@pstdio/ui/chat-ui";
import { ChevronDown, GitBranch } from "lucide-react";
import type { WorkbenchPanelRenderInput } from "../../../../../react";
import { dashboardMockChatMessages } from "../mock-data/sessions";

export const SessionWidget = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;

  return (
    <Box flex="1" minH="0">
      <ChatPanel
        conversationKey="dashboard-workbench-session"
        messages={dashboardMockChatMessages}
        streaming
        emptyStateTitle="No active conversations"
        emptyStateDescription="Start a conversation to see messages here."
        chatInputPlaceholder="Reply to the agent..."
        attachedResources={["PS-294", "project-shell.tsx"]}
        workspaceHub={
          <ChatWorkspaceHub
            workspaceControl={
              <Button size="xs" variant="ghost" px="2xs">
                <GitBranch size={14} />
                <Text textStyle="label/XS/medium" color="fg" ml="2xs">
                  Attempt A1
                </Text>
                <ChevronDown size={14} />
              </Button>
            }
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
