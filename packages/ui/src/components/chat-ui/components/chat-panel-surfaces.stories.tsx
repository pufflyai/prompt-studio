import { Box, Button, IconButton, Stack, Tabs } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { ArrowUpRight, GitBranch } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";
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
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const editor = canvas.getByTestId("content-editable");
    const input = editor.closest<HTMLElement>(".ps-chat-composer__input");
    if (!input) throw new Error("Chat input is missing");
    const tabs = canvas.getAllByRole("tab");
    await userEvent.click(tabs[0]);
    await expect(input).toHaveStyle({ borderWidth: "0px", outlineStyle: "none" });
    for (const tab of tabs) await expect(tab).toHaveStyle({ borderWidth: "0px" });
    const workspace = canvasElement.querySelector(".ps-chat-composer__workspace");
    if (args.workspaceHub) {
      await expect(workspace).toHaveStyle({ borderWidth: "0px", rowGap: "0px" });
      await expect(getComputedStyle(workspace as Element).backgroundColor).toBe(
        getComputedStyle(tabs[0]).backgroundColor,
      );
    }
    if (args.inputDisabled) return;
    const before = input.getBoundingClientRect();
    await userEvent.click(editor);
    await expect(input).toHaveStyle({ outlineStyle: "solid", outlineWidth: "1px", outlineOffset: "-1px" });
    const after = input.getBoundingClientRect();
    await expect([after.width, after.height, after.bottom]).toEqual([before.width, before.height, before.bottom]);
    if (!args.chatInputAutoFocus) {
      await userEvent.click(tabs[0]);
      await expect(input).toHaveStyle({ outlineStyle: "none" });
    }
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = { globals: { theme: "pstdio-light" } };
export const Dark: Story = { globals: { theme: "pstdio-dark" } };
export const WithoutWorkspace: Story = { args: { workspaceHub: undefined } };
export const Focused: Story = {
  args: { chatInputAutoFocus: true },
  parameters: {
    docs: { description: { story: "Focus inside the input highlights its edge without changing its size." } },
  },
};
export const FocusedDark: Story = { ...Focused, globals: { theme: "pstdio-dark" } };
export const FocusedWithoutWorkspace: Story = {
  ...Focused,
  args: { chatInputAutoFocus: true, workspaceHub: undefined },
};
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
