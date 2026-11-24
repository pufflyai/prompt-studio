import { Box, Button } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { ChatPanel } from "./chat-panel";
import { ChatSkeleton } from "./chat-skeleton";
import type { SessionMessage } from "./message-types";
import { ChatWorkspaceHub } from "./workspace-hub";

const messages: SessionMessage[] = [
  { id: "prompt", role: "user", parts: [{ type: "text", text: "Review the release checks." }] },
  {
    id: "response",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: Array.from(
          { length: 24 },
          (_, index) => `Check ${index + 1}: Review service health, errors, timing, and remaining work.`,
        ).join("\n\n"),
      },
    ],
  },
];
const meta: CanvasMeta<typeof ChatPanel> = {
  title: "Design system/Patterns/Chat/Chat panel width",
  component: ChatPanel,
  fullscreen: true,
  args: {
    messages,
    emptyStateTitle: "No messages yet",
    emptyStateDescription: "Send a message to start this session.",
    chatInputPlaceholder: "Type a message...",
    workspaceHub: (
      <ChatWorkspaceHub
        workspaceControl={
          <Button size="xs" variant="ghost">
            Release checks
          </Button>
        }
        additions={0}
        deletions={0}
      />
    ),
    queuedFollowUps: [{ id: "queued", prompt: "Prepare the release notes.", position: 1 }],
  },
};
export default meta;
type Story = CanvasFrame<typeof ChatPanel>;
export const WidePane: Story = {
  id: "patterns-chat-chat-panel-width--wide-pane",
  render: (args) => (
    <Box w="1200px" maxW="full" h="680px" bg="bg">
      <ChatPanel {...args} />
    </Box>
  ),
};
export const NarrowPane: Story = {
  id: "patterns-chat-chat-panel-width--narrow-pane",
  render: (args) => (
    <Box w="420px" maxW="full" h="680px" bg="bg">
      <ChatPanel {...args} />
    </Box>
  ),
};
export const EmptyWidePane: Story = {
  id: "patterns-chat-chat-panel-width--empty-wide-pane",
  ...WidePane,
  args: { messages: [], queuedFollowUps: [] },
};

export const LoadingWidePane: Story = {
  ...WidePane,
  args: { messages: [], queuedFollowUps: [], loading: true, loaderComponent: <ChatSkeleton /> },
};

const outlineTurnCount = 80;
const outlineMessages: SessionMessage[] = Array.from({ length: outlineTurnCount }, (_, index) => [
  {
    id: `q-${index}`,
    role: "user" as const,
    ...(index === 0 ? { sender: { type: "session" as const, id: "release-checks", name: "Release checks" } } : {}),
    ...(index === outlineTurnCount - 1 ? { sender: { type: "user" as const, id: "alex", name: "Alex" } } : {}),
    parts: [{ type: "text" as const, text: `Check build ${index + 1}` }],
  },
  {
    id: `a-${index}`,
    role: "assistant" as const,
    parts: [{ type: "text" as const, text: `Build ${index + 1} passed.` }],
  },
]).flat();

export const ConversationOutline: Story = {
  description:
    "A wide transcript exposes each turn in its outline. Attributed prompts show a sender avatar and name; older prompts without recorded attribution keep their appearance. Keyboard selection reaches virtualized turns, and narrowing the panel hides the gutter.",
  render: (args) => {
    const [wide, setWide] = useState(true);
    return (
      <Box w={wide ? "60rem" : "30rem"} h="30rem">
        <Button size="xs" onClick={() => setWide(!wide)}>
          Resize conversation
        </Button>
        <ChatPanel {...args} messages={outlineMessages} hideComposer />
      </Box>
    );
  },
};
