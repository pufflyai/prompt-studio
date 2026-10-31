import { Box, Button, IconButton, Stack, Tabs } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { ArrowUpRight, GitBranch } from "lucide-react";
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
const meta: CanvasMeta<typeof ChatPanel> = {
  title: "Patterns/Chat/Composer Surfaces",
  component: ChatPanel,
  args: {
    messages: [],
    emptyStateTitle: "Prepare release notes",
    emptyStateDescription: "Review the workspace changes and start a conversation.",
    chatInputPlaceholder: "Describe the release...",
    chatInputDefaultValue: "Summarize the changes in this workspace.",
    workspaceHub,
    onSubmitMessage: () => {},
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
type Story = CanvasFrame<typeof meta>;
export const Light: Story = {
  id: "patterns-chat-composer-surfaces--light",
};
export const Dark: Story = {
  id: "patterns-chat-composer-surfaces--dark",
};
export const WithoutWorkspace: Story = {
  id: "patterns-chat-composer-surfaces--without-workspace",
  args: { workspaceHub: undefined },
};
export const Focused: Story = {
  id: "patterns-chat-composer-surfaces--focused",
  args: { chatInputAutoFocus: true },
  description: "Focus inside the input highlights its edge without changing its size.",
};
export const FocusedDark: Story = {
  id: "patterns-chat-composer-surfaces--focused-dark",
  ...Focused,
};
export const FocusedWithoutWorkspace: Story = {
  id: "patterns-chat-composer-surfaces--focused-without-workspace",
  ...Focused,
  args: { chatInputAutoFocus: true, workspaceHub: undefined },
};
export const SettingUp: Story = {
  id: "patterns-chat-composer-surfaces--setting-up",
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
  id: "patterns-chat-composer-surfaces--setup-failed",
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
