import { Box, Button } from "@chakra-ui/react";
import { ChatPanel, ChatWorkspaceHub } from "@pstdio/ui/chat-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { SessionHarnessUnavailable } from "./session-harness-unavailable";

const meta = {
  title: "Modules/Sessions/Harness Unavailable",
  component: SessionHarnessUnavailable,
  args: { onReviewExtensions: fn() },
  parameters: { layout: "padded" },
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
        composerFallback={<SessionHarnessUnavailable {...args} />}
      />
    </Box>
  ),
} satisfies Meta<typeof SessionHarnessUnavailable>;

export default meta;
type Story = StoryObj<typeof meta>;
export const NoHarnessAvailable: Story = {};
export const Dark: Story = { globals: { theme: "pstdio-dark" } };
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <Box maxW="xs">
        <Story />
      </Box>
    ),
  ],
};
export const ActiveRun: Story = {
  args: { onInterrupt: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("textbox")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: /^Stop session$/ }));
    await expect(args.onInterrupt).toHaveBeenCalledOnce();
    await userEvent.click(canvas.getByRole("button", { name: /^Extensions$/ }));
    await expect(args.onReviewExtensions).toHaveBeenCalledOnce();
  },
};
