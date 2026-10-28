import { Box } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { ChatPanel } from "@pstdio/ui/chat-ui";
import { SessionPersonalDevice } from "./session-personal-device";

const meta = {
  title: "Modules/Sessions/Personal Device",
  component: SessionPersonalDevice,
  args: { name: "Laptop" },
  render: (args) => (
    <Box h="lg">
      <ChatPanel
        emptyStateTitle="Conversation"
        emptyStateDescription="Read the saved conversation."
        chatInputPlaceholder="Reply to the agent..."
        messages={[
          {
            id: "message",
            role: "assistant",
            parts: [{ type: "text", text: "The saved conversation is available while Laptop is offline." }],
          },
        ]}
        composerFallback={<SessionPersonalDevice {...args} />}
      />
    </Box>
  ),
} satisfies CanvasMeta<typeof SessionPersonalDevice>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const OfflineSource: Story = {
  id: "modules-sessions-personal-device--offline-source",
};
export const Dark: Story = {
  id: "modules-sessions-personal-device--dark",
  globals: { theme: "pstdio-dark" },
};
