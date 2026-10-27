import { Box, Button, IconButton } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { ArrowUpRight, GitBranch } from "lucide-react";
import { expect, within } from "storybook/test";
import { ChatPanel } from "./chat-panel";
import { ChatWorkspaceHub } from "./workspace-hub";

const meta = {
  title: "Patterns/Chat/Activity Layout",
  tags: ["chat-layout"],
  component: ChatPanel,
  args: {
    conversationKey: "activity-layout",
    messages: [
      { id: "user", role: "user", parts: [{ type: "text", text: "Check the workspace." }] },
      { id: "assistant", role: "assistant", parts: [{ type: "text", text: "I will check the files." }] },
      {
        id: "tool",
        role: "assistant",
        parts: [
          {
            type: "tool",
            tool: "Bash",
            status: "completed",
            state: { input: { command: "bun run typecheck" }, output: "All checks passed." },
          },
        ],
      },
    ],
    streaming: true,
    streamingStartedAt: Date.now() - 65_000,
    emptyStateTitle: "No messages",
    emptyStateDescription: "Start a conversation.",
    chatInputPlaceholder: "Reply...",
    workspaceHub: (
      <ChatWorkspaceHub
        additions={12}
        deletions={3}
        workspaceControl={
          <Button size="xs" variant="ghost">
            <GitBranch /> main
          </Button>
        }
        action={
          <IconButton size="xs" variant="ghost" aria-label="Open workspace">
            <ArrowUpRight />
          </IconButton>
        }
      />
    ),
  },
  render: (args) => (
    <Box w="full" maxW="chat-content" h="xl">
      <ChatPanel {...args} />
    </Box>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const workspace = canvasElement.querySelector(".ps-chat-composer__workspace")!;
    const timer = canvas.getByText(/^\d+m \d+s$/);
    await expect(workspace).toContainElement(timer);
    const open = canvas.getByRole("button", { name: "Open workspace" }).getBoundingClientRect();
    const identity = canvas.getByRole("button", { name: "main" }).getBoundingClientRect();
    const time = timer.getBoundingClientRect();
    await expect(open.left).toBeLessThan(identity.left);
    await expect(time.left).toBeGreaterThan(identity.right);
    await expect(Math.abs(time.top - open.top)).toBeLessThan(open.height);
    const assistant = canvas.getByText("I will check the files.").closest(".ai-message__root")!;
    await expect(parseFloat(getComputedStyle(assistant).marginBottom)).toBeGreaterThan(0);
    const indicator = canvasElement.querySelector(".chakra-timeline__indicator")!;
    await expect(getComputedStyle(indicator).backgroundColor).toBe("rgba(0, 0, 0, 0)");
  },
} satisfies Meta<typeof ChatPanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const WorkspaceActivity: Story = {};
export const Narrow: Story = {
  render: (args) => (
    <Box w="80" h="xl">
      <ChatPanel {...args} />
    </Box>
  ),
};
