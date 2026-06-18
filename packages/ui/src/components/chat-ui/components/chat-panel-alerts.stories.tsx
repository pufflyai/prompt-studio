import { Box, Button, Icon } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { ArrowUpRight } from "lucide-react";
import { ChatPanel } from "./chat-panel";
import type { SessionMessage } from "./message-types";
import { ChatWorkspaceHub } from "./workspace-hub";

const meta: Meta<typeof ChatPanel> = {
  title: "Patterns/Chat/Chat Panel/Alerts",
  component: ChatPanel,
  parameters: { layout: "padded" },
};

export default meta;

type Story = StoryObj<typeof ChatPanel>;

const container = {
  w: "960px",
  maxW: "100%",
  h: "680px",
  bg: "bg",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "lg",
  p: "md",
} as const;

const baseArgs = {
  streaming: false,
  emptyStateTitle: "",
  emptyStateDescription: "",
  chatInputPlaceholder: "Type a message...",
};

const alertVariantsMessages: SessionMessage[] = [
  {
    id: "user-1",
    role: "user",
    parts: [{ type: "text", text: "Show me all alert styles" }],
  },
  {
    id: "alert-info",
    role: "assistant",
    parts: [{ type: "alert", status: "info", title: "Branch checked out", message: "Switched to workspace/PS-42_A1" }],
  },
  {
    id: "alert-success",
    role: "assistant",
    parts: [{ type: "alert", status: "success", title: "Workspace ready" }],
  },
  {
    id: "alert-warning",
    role: "assistant",
    parts: [
      {
        type: "alert",
        status: "warning",
        title: "Merge conflicts detected",
        message: "3 files have conflicts that need manual resolution.",
      },
    ],
  },
  {
    id: "alert-error",
    role: "assistant",
    parts: [
      {
        type: "alert",
        status: "error",
        title: "Hook failed",
        message: "pre-commit hook exited with code 1: lint errors found.",
      },
    ],
  },
  {
    id: "alert-loading",
    role: "assistant",
    parts: [
      {
        type: "alert",
        status: "loading",
        title: "Setting up workspace...",
        message: "Installing dependencies and preparing environment",
      },
    ],
  },
];

export const AlertVariants: Story = {
  render: (args) => (
    <Box {...container}>
      <ChatPanel {...args} />
    </Box>
  ),
  args: { ...baseArgs, messages: alertVariantsMessages },
};

const workspaceSetupMessages: SessionMessage[] = [
  {
    id: "user-prompt",
    role: "user",
    parts: [{ type: "text", text: "/implement PS-104" }],
  },
];

export const WorkspaceInitializing: Story = {
  render: (args) => (
    <Box {...container}>
      <ChatPanel {...args} />
    </Box>
  ),
  args: {
    ...baseArgs,
    messages: workspaceSetupMessages,
    streaming: true,
    workspaceInitializing: true,
    workspaceHub: (
      <ChatWorkspaceHub
        changesLabel=""
        additions={0}
        deletions={0}
        status="loading"
        statusLabel="Setting up workspace — installing dependencies"
      />
    ),
  },
};

const workspaceReadyMessages: SessionMessage[] = [
  {
    id: "user-prompt",
    role: "user",
    parts: [{ type: "text", text: "/implement PS-104" }],
  },
  {
    id: "assistant-1",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "I'll start implementing the hooks system. Let me read the ticket and the existing codebase first.",
      },
    ],
  },
];

export const WorkspaceReady: Story = {
  render: (args) => (
    <Box {...container}>
      <ChatPanel {...args} />
    </Box>
  ),
  args: {
    ...baseArgs,
    messages: workspaceReadyMessages,
    workspaceHub: (
      <ChatWorkspaceHub
        changesLabel="0 files changed"
        additions={0}
        deletions={0}
        action={
          <Button size="sm" variant="plain">
            Review changes
            <Icon as={ArrowUpRight} boxSize={4} />
          </Button>
        }
      />
    ),
  },
};

const errorAfterSetupMessages: SessionMessage[] = [
  {
    id: "user-prompt",
    role: "user",
    parts: [{ type: "text", text: "/implement PS-104" }],
  },
];

export const WorkspaceSetupFailed: Story = {
  render: (args) => (
    <Box {...container}>
      <ChatPanel {...args} />
    </Box>
  ),
  args: {
    ...baseArgs,
    messages: errorAfterSetupMessages,
    inputDisabled: true,
    workspaceHub: (
      <ChatWorkspaceHub
        changesLabel=""
        additions={0}
        deletions={0}
        status="error"
        statusLabel="Setup failed — bun install could not resolve dependencies"
        action={
          <Button size="sm" variant="outline" colorPalette="red">
            Edit hook
            <Icon as={ArrowUpRight} boxSize={4} />
          </Button>
        }
      />
    ),
  },
};
