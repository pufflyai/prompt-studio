import { Box } from "@chakra-ui/react";
import { ChatPanel } from "@pstdio/ui/chat-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
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
} satisfies Meta<typeof SessionPersonalDevice>;
export default meta;
type Story = StoryObj<typeof meta>;
export const OfflineSource: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Session on Laptop")).toBeVisible();
    await expect(
      canvas.queryAllByRole("textbox").filter((element) => element.getAttribute("contenteditable") === "true"),
    ).toHaveLength(0);
  },
};
export const Dark: Story = { globals: { theme: "pstdio-dark" } };
