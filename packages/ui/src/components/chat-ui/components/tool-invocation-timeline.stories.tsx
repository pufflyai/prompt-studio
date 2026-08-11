import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import rawConversationMessages from "../mocks/full-conversation-normalized.json";
import type { SessionMessage, ToolPart } from "./message-types";
import { ToolInvocationTimeline } from "./tool-invocation-timeline";

const conversationMessages = rawConversationMessages as unknown as SessionMessage[];

const toolInvocations = conversationMessages
  .flatMap((message) => message.parts ?? [])
  .filter((part): part is ToolPart => part.type === "tool")
  .slice(0, 10);

const claudeToolInvocations: ToolPart[] = [
  {
    type: "tool",
    tool: "Read",
    status: "completed",
    state: {
      input: { file_path: "/workspace/.pstdio/tickets/PS-49/ticket.md" },
      output: { filePath: "/workspace/.pstdio/tickets/PS-49/ticket.md" },
    },
  },
  {
    type: "tool",
    tool: "Edit",
    status: "completed",
    state: {
      input: { file_path: "/workspace/.pstdio/tickets/PS-49/ticket.md" },
      output: {
        filePath: "/workspace/.pstdio/tickets/PS-49/ticket.md",
        oldString:
          'Today, hooks embed prompt text directly in shell scripts:\n\n```sh\npstdio sessions follow-up --id "$SESSION_ID" \\\n+  --prompt "Fix the errors."\n```',
        newString:
          'Today, hooks like `post-attempt-status-changes-requested` embed prompt text directly in shell scripts:\n\n```sh\npstdio sessions follow-up --id "$PSTDIO_ORIGINAL_SESSION_ID" \\\n+  --prompt "Fix the issues described in .pstdio/tickets/$PSTDIO_TICKET/review.md."\n```',
      },
    },
  },
  {
    type: "tool",
    tool: "Bash",
    status: "completed",
    state: {
      input: {
        command:
          "bun add mustache --cwd packages/pstdio-api && bun run --cwd packages/pstdio-api test && bun run --cwd packages/pstdio-api typecheck",
      },
      output: {
        stdout:
          "bun add v1.3.10 (30e609e0)\nResolving dependencies\nResolved, downloaded and extracted [14]\nSaved lockfile\n\ninstalled mustache@4.2.0 with binaries:\n - mustache\n\n[616.00ms] done",
      },
    },
  },
  {
    type: "tool",
    tool: "TodoWrite",
    status: "completed",
    state: {
      output: {
        newTodos: [
          {
            content: "Add transcript-driven timeline tests",
            status: "completed",
            priority: "high",
          },
          {
            content: "Implement Edit renderer",
            status: "completed",
            priority: "high",
          },
          {
            content: "Validate Storybook output",
            status: "in_progress",
            priority: "medium",
          },
        ],
      },
    },
  },
  {
    type: "tool",
    tool: "Skill",
    status: "completed",
    state: {
      input: { skill: "implement-ticket" },
      output: { returnDisplay: "Launching skill: implement-ticket" },
    },
  },
];

const meta: Meta<typeof ToolInvocationTimeline> = {
  title: "Patterns/Chat/Tool Invocation Timeline",
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
      <ToolInvocationTimeline invocations={claudeToolInvocations} />
    </Box>
  ),
};

const codexShellInvocations: ToolPart[] = [
  {
    type: "tool",
    tool: "shell",
    status: "completed",
    state: {
      status: "completed",
      input: {
        command:
          "bun run --cwd packages/ui test tool-rendering && bun run --cwd packages/ui build-storybook && bun run validate",
      },
      output:
        "26 [chromium] › src/ui/workspaces.spec.ts:192:3 › Workspace diff › fork_point resolves\n27 [chromium] › src/ui/workspaces.spec.ts:223:3 › Workspace diff › fork_point handles rebase\n28 [chromium] › src/ui/workspaces.spec.ts:273:3 › Workspace rename › renames the branch\n\n3 skipped\n25 passed (34.1s)",
    },
  },
];

export const CodexShell: Story = {
  render: () => (
    <Box maxW="960px" w="full" borderWidth="1px" borderRadius="md" bg="bg" p="md">
      <ToolInvocationTimeline invocations={codexShellInvocations} />
    </Box>
  ),
};

const codexApplyPatchInvocations: ToolPart[] = [
  {
    type: "tool",
    tool: "apply_patch",
    status: "completed",
    state: {
      input: {
        changes: [
          { path: "packages/ui/src/components/chat-ui/components/chat-message-list.tsx", kind: "update" },
          { path: "packages/ui/src/components/chat-ui/components/chat-message-list-items.tsx", kind: "add" },
        ],
      },
    },
  },
];

export const CodexApplyPatch: Story = {
  render: () => (
    <Box maxW="960px" w="full" borderWidth="1px" borderRadius="md" bg="bg" p="md">
      <ToolInvocationTimeline invocations={codexApplyPatchInvocations} />
    </Box>
  ),
};

const questionAndTodoInvocations: ToolPart[] = [
  {
    type: "tool",
    tool: "question",
    state: {
      input: {
        questions: [
          {
            id: "implementation",
            question: "Which implementation path should be used?",
            options: [
              {
                label: "Keep it simple",
                description: "Use the smallest working change.",
              },
              {
                label: "Refactor first",
                description: "Clean up the surface before adding behavior.",
              },
            ],
            required: true,
          },
          {
            id: "notes",
            type: "freeform",
            question: "Additional constraints",
          },
        ],
      },
    },
  },
  {
    type: "tool",
    tool: "TodoWrite",
    state: {
      status: "completed",
      input: {
        todos: [
          { content: "Render question form", status: "completed" },
          { content: "Simplify todo list", status: "in_progress" },
        ],
      },
    },
  },
];

export const QuestionAndTodoWrite: Story = {
  render: () => (
    <Box maxW="960px" w="full" borderWidth="1px" borderRadius="md" bg="bg" p="md">
      <ToolInvocationTimeline invocations={questionAndTodoInvocations} />
    </Box>
  ),
};
