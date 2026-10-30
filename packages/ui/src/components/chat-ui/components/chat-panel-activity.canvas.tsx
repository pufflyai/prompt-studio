import { Box, Button, IconButton } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { ArrowUpRight, GitBranch } from "lucide-react";
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
} satisfies CanvasMeta<typeof ChatPanel>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const WorkspaceActivity: Story = { id: "patterns-chat-activity-layout--workspace-activity" };
export const Narrow: Story = {
  id: "patterns-chat-activity-layout--narrow",
  render: (args) => (
    <Box w="80" h="xl" bg="bg.panel">
      <ChatPanel {...args} />
    </Box>
  ),
};
export const AnswerAfterActivity: Story = {
  id: "patterns-chat-activity-layout--answer-after-activity",
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
export const ScrollAwareActivity: Story = {
  id: "patterns-chat-activity-layout--scroll-aware-activity",
  args: {
    messages: [
      { id: "user", role: "user", parts: [{ type: "text", text: "Review the project." }] },
      ...Array.from({ length: 24 }, (_, index) => ({
        id: `reply-${index}`,
        role: "assistant" as const,
        parts: [
          {
            type: "text" as const,
            text: `Reviewed file ${index + 1}.\n\nThe implementation follows the shared project rules.`,
          },
        ],
      })),
    ],
  },
};
