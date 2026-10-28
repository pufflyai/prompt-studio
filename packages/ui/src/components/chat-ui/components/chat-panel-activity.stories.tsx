import { Box, Button, IconButton } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { ArrowUpRight, GitBranch } from "lucide-react";
import { expect, userEvent, waitFor, within } from "storybook/test";
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
          {
            type: "tool",
            tool: "Read",
            status: "completed",
            state: { input: { file_path: "package.json" } },
          },
        ],
      },
    ],
    streaming: true,
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
    const timer = canvas.getByText(/^\d+[smh](?: \d+[sm])?$/);
    await expect(workspace).toContainElement(timer);
    await expect(getComputedStyle(workspace.parentElement!).paddingTop).toBe("0px");
    const open = canvas.getByRole("button", { name: "Open workspace" }).getBoundingClientRect();
    const identity = canvas.getByRole("button", { name: "main" }).getBoundingClientRect();
    const time = timer.getBoundingClientRect();
    await expect(open.left).toBeGreaterThanOrEqual(identity.right);
    await expect(open.left - identity.right).toBeLessThanOrEqual(12);
    await expect(time.left).toBeGreaterThan(identity.right);
    await expect(Math.abs(time.top - open.top)).toBeLessThan(open.height);
    const assistant = canvas.getByText("I will check the files.").closest(".ai-message__root")!;
    await expect(parseFloat(getComputedStyle(assistant).marginBottom)).toBeGreaterThan(0);
    const paragraph = canvas.getByText("I will check the files.").closest("p")!;
    await expect(parseFloat(getComputedStyle(paragraph).marginTop)).toBeGreaterThan(0);
    for (const indicator of canvasElement.querySelectorAll(".chakra-timeline__indicator")) {
      await expect(getComputedStyle(indicator).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    }
    for (const separator of canvasElement.querySelectorAll(".chakra-timeline__separator")) {
      await expect(getComputedStyle(separator).display).toBe("none");
    }
    const command = canvas.getByText("Run command", { exact: true });
    await userEvent.click(command);
    const expanded = canvasElement.querySelector<HTMLElement>(".chakra-timeline__separator[data-state=open]")!;
    const icon = expanded.parentElement!.querySelector(".chakra-timeline__indicator")!;
    await expect(getComputedStyle(expanded).display).toBe("block");
    await expect(expanded.getBoundingClientRect().top).toBeGreaterThan(icon.getBoundingClientRect().bottom);
    await waitFor(() => expect(expanded.getBoundingClientRect().height).toBeGreaterThan(0));
    await userEvent.click(command);
    await expect(getComputedStyle(expanded).display).toBe("none");
  },
} satisfies Meta<typeof ChatPanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const WorkspaceActivity: Story = {};
export const Narrow: Story = {
  render: (args) => (
    <Box w="80" h="xl" bg="bg.panel">
      <ChatPanel {...args} />
    </Box>
  ),
};
export const AnswerAfterActivity: Story = {
  args: {
    messages: [
      { id: "user", role: "user", parts: [{ type: "text", text: "Check the workspace." }] },
      {
        id: "assistant",
        role: "assistant",
        parts: [
          { type: "reasoning", text: "Review the available files." },
          {
            type: "tool",
            tool: "Bash",
            status: "completed",
            state: { input: { command: "bun run typecheck" }, output: "All checks passed." },
          },
          { type: "text", text: "I will check the files." },
        ],
      },
    ],
  },
};
