import { Box, Button, IconButton, Stack, Tabs } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { ArrowUpRight, GitBranch } from "lucide-react";
import { fn } from "storybook/test";
import { ChatPanel } from "./chat-panel";
import { ChatWorkspaceHub } from "./workspace-hub";

const workspaceControl = (
  <Button size="xs" variant="ghost">
    <GitBranch />
    release-notes
  </Button>
);

const workspaceHub = (
  <ChatWorkspaceHub
    workspaceControl={workspaceControl}
    additions={24}
    deletions={6}
    action={
      <IconButton size="xs" variant="ghost" aria-label="Open workspace">
        <ArrowUpRight />
      </IconButton>
    }
  />
);

const meta: Meta<typeof ChatPanel> = {
  title: "Patterns/Chat/Composer Surfaces",
  component: ChatPanel,
  parameters: { layout: "padded" },
  args: {
    messages: [],
    emptyStateTitle: "Prepare release notes",
    emptyStateDescription: "Review the workspace changes and start a conversation.",
    chatInputPlaceholder: "Describe the release...",
    chatInputDefaultValue: "Summarize the changes in this workspace.",
    workspaceHub,
    onSubmitMessage: fn(),
  },
  render: (args) => (
    <Stack maxW="chat-content" gap="sm">
      <Tabs.Root defaultValue="conversation" size="sm">
        <Tabs.List>
          <Tabs.Trigger value="conversation">Conversation</Tabs.Trigger>
          <Tabs.Trigger value="files">Files</Tabs.Trigger>
          <Tabs.Trigger value="archived" disabled>
            Archived
          </Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>
      <Box h="lg">
        <ChatPanel {...args} />
      </Box>
    </Stack>
  ),
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = { globals: { theme: "pstdio-light" } };
export const Dark: Story = { globals: { theme: "pstdio-dark" } };
export const WithoutWorkspace: Story = { args: { workspaceHub: undefined } };
export const Focused: Story = { args: { chatInputAutoFocus: true } };
export const SettingUp: Story = {
  args: {
    inputDisabled: true,
    workspaceHub: (
      <ChatWorkspaceHub
        workspaceControl={workspaceControl}
        additions={0}
        deletions={0}
        status="loading"
        statusLabel="Setting up workspace"
      />
    ),
  },
};
export const SetupFailed: Story = {
  args: {
    workspaceHub: (
      <ChatWorkspaceHub
        workspaceControl={workspaceControl}
        additions={0}
        deletions={0}
        status="error"
        statusLabel="Workspace setup failed"
      />
    ),
  },
};
