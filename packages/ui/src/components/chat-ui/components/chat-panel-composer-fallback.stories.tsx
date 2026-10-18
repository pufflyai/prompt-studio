import { Box, Button, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { AlertMessage } from "@/components/primitives/alert";
import { ChatPanel, type ChatPanelProps } from "./chat-panel";

const editable = (canvas: HTMLElement) => canvas.querySelector<HTMLElement>('[role="textbox"][contenteditable="true"]');

const ComposerFallbackStory = (props: ChatPanelProps) => {
  const [unavailable, setUnavailable] = useState(true);
  const [draft, setDraft] = useState("Keep this unsent draft.");
  return (
    <Stack h="lg">
      <Button size="sm" onClick={() => setUnavailable((value) => !value)}>
        Toggle messaging availability
      </Button>
      <Box flex="1" minH="0">
        <ChatPanel
          {...props}
          chatInputDefaultValue={draft}
          onChatInputChange={setDraft}
          composerFallback={
            unavailable ? <AlertMessage status="warning" title="Messaging is unavailable" /> : undefined
          }
        />
      </Box>
    </Stack>
  );
};

const meta = {
  title: "Patterns/Chat/Composer Fallback",
  component: ChatPanel,
  render: (args) => <ComposerFallbackStory {...args} />,
  args: {
    messages: [
      { id: "reply", role: "assistant", parts: [{ type: "text", text: "The saved conversation stays visible." }] },
    ],
    emptyStateTitle: "Conversation",
    emptyStateDescription: "",
    chatInputPlaceholder: "Reply...",
    actions: <Button size="xs">Message settings</Button>,
    attachmentActions: <Button size="xs">Upload files</Button>,
    workspaceHub: <Button size="xs">Select workspace</Button>,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(editable(canvasElement)).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Upload files" })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Message settings" })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Select workspace" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Toggle messaging availability" }));
    const editor = editable(canvasElement)!;
    await expect(editor).toHaveTextContent("Keep this unsent draft.");
    await userEvent.click(editor);
    await userEvent.keyboard(" More details.");
    const editedDraft = editor.textContent;
    await userEvent.click(canvas.getByRole("button", { name: "Toggle messaging availability" }));
    await expect(editable(canvasElement)).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Toggle messaging availability" }));
    await expect(editable(canvasElement)).toHaveTextContent(editedDraft!);
  },
} satisfies Meta<typeof ChatPanel>;

export default meta;
type Story = StoryObj<typeof meta>;
export const RetainedDraft: Story = {};
export const Dark: Story = { globals: { theme: "pstdio-dark" } };
export const RetainedQueuedEdit: Story = {
  args: {
    queuedFollowUps: [{ id: "queued", prompt: "Review the changes.", position: 1 }],
    onQueuedFollowUpUpdate: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole("button", { name: "Toggle messaging availability" });
    await userEvent.click(toggle);
    await userEvent.click(canvas.getByRole("button", { name: /^Edit queued message:/ }));
    await userEvent.click(editable(canvasElement)!);
    await userEvent.keyboard(" Keep this edit.");
    const edit = editable(canvasElement)!.textContent;
    await userEvent.click(toggle);
    await expect(editable(canvasElement)).not.toBeInTheDocument();
    await userEvent.click(toggle);
    await expect(editable(canvasElement)).toHaveTextContent(edit!);
    await userEvent.click(canvas.getByRole("button", { name: /^Cancel$/ }));
    await expect(editable(canvasElement)).toHaveTextContent("Keep this unsent draft.");
  },
};
