import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, waitFor, within } from "storybook/test";
import { ChatPanel } from "./chat-panel";

const meta: Meta<typeof ChatPanel> = {
  title: "Patterns/Chat/Message Surfaces",
  component: ChatPanel,
  parameters: { layout: "padded" },
  args: {
    messages: [
      { id: "user", role: "user", parts: [{ type: "text", text: "Summarize the remaining release risks." }] },
      {
        id: "assistant",
        role: "assistant",
        parts: [{ type: "text", text: "Two risks remain: the migration backup and the Windows installer size." }],
      },
    ],
    emptyStateTitle: "No messages",
    emptyStateDescription: "Start a conversation.",
    chatInputPlaceholder: "Reply...",
  },
  render: (args) => (
    <Box maxW="chat-content" h="md">
      <ChatPanel {...args} />
    </Box>
  ),
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvasElement.ownerDocument.documentElement).toHaveAttribute("data-theme", globals.theme),
    );
    const userText = await canvas.findByText("Summarize the remaining release risks.");
    await waitFor(async () => {
      const chatBackground = getComputedStyle(userText.closest(".ps-chat-panel")!).backgroundColor;
      const messageBackground = getComputedStyle(userText.closest(".ai-message__content")!).backgroundColor;
      await expect(messageBackground).not.toBe(chatBackground);
    });
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = { globals: { theme: "pstdio-light" } };
export const Dark: Story = { globals: { theme: "pstdio-dark" } };
export const VsCodeMonokai: Story = { globals: { theme: "vscode-monokai" } };
export const VsCodeDracula: Story = { globals: { theme: "vscode-dracula" } };
export const VsCodeSolarizedLight: Story = { globals: { theme: "vscode-solarized-light" } };
