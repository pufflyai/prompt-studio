import { Box, Button } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { ChatPanel } from "./chat-panel";
import type { SessionMessage } from "./message-types";
import { ChatWorkspaceHub } from "./workspace-hub";

const meta = {
  title: "Design system/Patterns/Chat/Message surfaces",
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
type Story = CanvasFrame<typeof meta>;

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

export const LongUserMessage: Story = {
  args: {
    messages: [
      {
        id: "long-user",
        role: "user",
        parts: [
          {
            type: "text",
            text: Array.from(
              { length: 20 },
              (_, index) => `Release check ${index + 1}: review the result and document any remaining work.`,
            ).join("\n\n"),
          },
        ],
      },
    ],
  },
};

export const WithWorkspace: Story = {
  description: "User message bubbles and the workspace container share the xs radius token.",
  args: {
    workspaceHub: (
      <ChatWorkspaceHub
        workspaceControl={
          <Button size="xs" variant="ghost">
            Workspace
          </Button>
        }
        additions={0}
        deletions={0}
      />
    ),
  },
};

export const DeliveryHandoff: Story = {
  description:
    "A new user turn fades once. Server confirmation and native message replacement keep the same visible row, rich-text renderer and expansion state without replaying it.",
  render: (args) => {
    const [messages, setMessages] = useState<SessionMessage[]>(args.messages);
    const replaceLastUser = (id: string) =>
      setMessages((current) =>
        current.map((message, index) => (index === current.length - 1 ? { ...message, id } : message)),
      );
    return (
      <Box maxW="chat-content" h="md">
        <Button
          onClick={() =>
            setMessages((current) => [
              ...current,
              {
                id: `pending-${current.length}`,
                animationKey: `pending-${current.length}`,
                role: "user",
                parts: [{ type: "text", text: "Check the release risks again." }],
              },
            ])
          }
        >
          Send user message
        </Button>
        <Button onClick={() => replaceLastUser(`saved-${messages.length}`)}>Confirm delivery</Button>
        <Button onClick={() => replaceLastUser(`native-${messages.length}`)}>Receive native message</Button>
        <ChatPanel {...args} conversationKey="delivery-handoff" messages={messages} />
      </Box>
    );
  },
};
