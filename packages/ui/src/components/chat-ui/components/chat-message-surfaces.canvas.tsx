import { Box } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { ChatPanel } from "./chat-panel";

const meta = {
  title: "Patterns/Chat/Message Surfaces",
  component: ChatPanel,
  render: (args) => (
    <Box maxW="chat-content" h="md">
      <ChatPanel {...args} />
    </Box>
  ),
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
} satisfies CanvasMeta<typeof ChatPanel>;

export default meta;
type Story = CanvasVariant<typeof meta>;

export const Light: Story = { id: "patterns-chat-message-surfaces--light", defaultTheme: "pstdio-light" };
export const Dark: Story = { id: "patterns-chat-message-surfaces--dark", defaultTheme: "pstdio-dark" };
export const ContrastLight: Story = {
  id: "patterns-chat-message-surfaces--contrast-light",
  defaultTheme: "prompt-contrast-light",
};
export const ContrastDark: Story = {
  id: "patterns-chat-message-surfaces--contrast-dark",
  defaultTheme: "prompt-contrast-dark",
};
export const VsCodeMonokai: Story = {
  id: "patterns-chat-message-surfaces--vs-code-monokai",
  defaultTheme: "vscode-monokai",
};
export const VsCodeDracula: Story = {
  id: "patterns-chat-message-surfaces--vs-code-dracula",
  defaultTheme: "vscode-dracula",
};
export const VsCodeSolarizedLight: Story = {
  id: "patterns-chat-message-surfaces--vs-code-solarized-light",
  defaultTheme: "vscode-solarized-light",
};
