import { Box, Button } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { ChatPanel, ChatWorkspaceHub } from "@pstdio/ui/chat-ui";
import { SessionHarnessUnavailable } from "./session-harness-unavailable";

const meta = {
  title: "Modules/Sessions/Harness Unavailable",
  component: SessionHarnessUnavailable,
  args: { onReviewExtensions: () => {} },
  render: (args) => (
    <Box h="lg">
      <ChatPanel
        messages={[]}
        emptyStateTitle="New conversation"
        emptyStateDescription="Start a conversation with an agent."
        chatInputPlaceholder="Reply to the agent..."
        workspaceHub={
          <ChatWorkspaceHub
            workspaceControl={
              <Button size="xs" variant="ghost">
                Project folder
              </Button>
            }
            additions={0}
            deletions={0}
          />
        }
        hideComposer
        emptyStateContent={<SessionHarnessUnavailable {...args} />}
      />
    </Box>
  ),
} satisfies CanvasMeta<typeof SessionHarnessUnavailable>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const NoHarnessAvailable: Story = {
  id: "modules-sessions-harness-unavailable--no-harness-available",
};
export const Dark: Story = {
  id: "modules-sessions-harness-unavailable--dark",
};
export const Narrow: Story = {
  id: "modules-sessions-harness-unavailable--narrow",
  decorators: [
    (Story) => (
      <Box maxW="xs">
        <Story />
      </Box>
    ),
  ],
};
export const ActiveRun: Story = {
  id: "modules-sessions-harness-unavailable--active-run",
  args: { onInterrupt: () => {} },
};
