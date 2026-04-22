import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { SessionMessage, ToolPart } from "../agent-types";
import rawConversationMessages from "../mocks/full-conversation-normalized.json";
import { ToolInvocationTimeline } from "./tool-invocation-timeline";

const conversationMessages = rawConversationMessages as unknown as SessionMessage[];

const toolInvocations = conversationMessages
  .flatMap((message) => message.parts ?? [])
  .filter((part): part is ToolPart => part.type === "tool")
  .slice(0, 10);

const claudeCodeToolInvocations: ToolPart[] = [
  {
    type: "tool",
    tool: "Read",
    status: "completed",
    state: {
      status: "completed",
      input: { filePath: ".pstdio/tickets/PS-49/ticket.md" },
    },
  },
  {
    type: "tool",
    tool: "Edit",
    status: "completed",
    state: {
      status: "completed",
      input: {
        file_path: "packages/ui/src/components/chat-ui/tool-rendering/default-renderers.ts",
        old_string: "const renderer = null;",
        new_string: "const renderer = createRenderer();",
      },
    },
  },
  {
    type: "tool",
    tool: "Bash",
    status: "completed",
    state: {
      status: "completed",
      input: { command: "bun add mustache" },
      output: "bun add v1.3.11\ninstalled mustache",
      metadata: { exitCode: 0 },
    },
  },
  {
    type: "tool",
    tool: "TodoWrite",
    status: "completed",
    state: {
      status: "completed",
      input: {
        todos: [
          { content: "Inspect renderer lookup", status: "completed", priority: "high" },
          { content: "Implement Edit renderer", status: "in_progress", priority: "medium" },
          { content: "Run validate", status: "pending", priority: "high" },
        ],
      },
    },
  },
  {
    type: "tool",
    tool: "Skill",
    status: "completed",
    state: {
      status: "completed",
      input: { name: "implement-ticket" },
      output: '<skill_content name="implement-ticket">Use the ticket workflow.</skill_content>',
    },
  },
];

const meta: Meta<typeof ToolInvocationTimeline> = {
  title: "Chat UI/Tool Invocation Timeline",
  component: ToolInvocationTimeline,
  parameters: {
    layout: "padded",
  },
};

export default meta;

type Story = StoryObj<typeof ToolInvocationTimeline>;

export const FromConversationData: Story = {
  render: () => (
    <Box maxW="960px" w="full" borderWidth="1px" borderRadius="md" bg="bg" p="md">
      <ToolInvocationTimeline invocations={toolInvocations} />
    </Box>
  ),
};

export const ClaudeCodeTools: Story = {
  render: () => (
    <Box maxW="960px" w="full" borderWidth="1px" borderRadius="md" bg="bg" p="md">
      <ToolInvocationTimeline invocations={claudeCodeToolInvocations} />
    </Box>
  ),
};
