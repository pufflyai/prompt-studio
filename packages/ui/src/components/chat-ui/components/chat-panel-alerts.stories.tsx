import { Box, Button, Icon, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { ArrowUpRight, ChevronDown, GitBranch } from "lucide-react";
import { AlertMessage } from "@/components/primitives/alert";
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

const workspaceControl = (
  <Button size="xs" variant="ghost" px="2xs">
    <GitBranch size={14} />
    <Text textStyle="label/XS/medium" color="fg" ml="2xs">
      main
    </Text>
    <ChevronDown size={14} />
  </Button>
);

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
        workspaceControl={workspaceControl}
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
        workspaceControl={workspaceControl}
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
        workspaceControl={workspaceControl}
        additions={0}
        deletions={0}
        status="error"
        statusLabel="Setup failed — bun install could not resolve dependencies"
        action={
          <Button size="sm" variant="destructive">
            Edit hook
            <Icon as={ArrowUpRight} boxSize={4} />
          </Button>
        }
      />
    ),
  },
};

const retry = (
  <Button size="2xs" variant="outline">
    Retry
  </Button>
);

const sentConversation: SessionMessage[] = [
  { id: "user-sent", role: "user", parts: [{ type: "text", text: "Check the board" }], createdAt: Date.now() - 60_000 },
  { id: "assistant-reply", role: "assistant", parts: [{ type: "text", text: "The board has 32 active tickets." }] },
];

// The chat has no banners: problems appear in the conversation, where the user is looking.
export const MessageNotSent: Story = {
  render: (args) => (
    <Box {...container}>
      <ChatPanel {...args} />
    </Box>
  ),
  args: {
    ...baseArgs,
    messages: [
      ...sentConversation,
      {
        id: "user-unsent",
        role: "user",
        parts: [{ type: "text", text: "Summarize the open tickets." }],
        delivery: "unsent",
      },
    ],
    conversationNotices: (
      <AlertMessage status="error" title="Message not sent" onClose={() => {}} endElement={retry}>
        The network is unavailable.
      </AlertMessage>
    ),
  },
};

export const ConversationCouldNotLoad: Story = {
  render: (args) => (
    <Box {...container}>
      <ChatPanel {...args} />
    </Box>
  ),
  args: {
    ...baseArgs,
    messages: sentConversation,
    conversationNotices: (
      <AlertMessage status="error" title="Could not load conversation" onClose={() => {}} endElement={retry}>
        The server had a temporary problem.
      </AlertMessage>
    ),
  },
};

export const ConversationGone: Story = {
  render: (args) => (
    <Box {...container}>
      <ChatPanel {...args} />
    </Box>
  ),
  args: {
    ...baseArgs,
    messages: [],
    conversationNotices: (
      <AlertMessage status="error" title="Could not load conversation" onClose={() => {}}>
        This session no longer exists.
      </AlertMessage>
    ),
  },
};
