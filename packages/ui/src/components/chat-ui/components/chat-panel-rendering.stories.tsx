import { Box, Button, HStack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useRef, useState } from "react";
import { updateStreamingTextPart } from "../performance/chat-performance-fixtures";
import { defaultChatPanelProps, markAfterPaint, streamMessages } from "../performance/chat-performance-story-utils";
import { chatRenderingFixtures, renderingStreamTail } from "../performance/chat-rendering-fixtures";
import { ChatPanel } from "./chat-panel";
import { validateContinuousChatScroll } from "./chat-panel-continuous-scroll.play";
import { validateLongTurnRendering } from "./chat-panel-rendering.play";
import type { SessionMessage } from "./message-types";

const meta: Meta<typeof ChatPanel> = {
  title: "Patterns/Chat/Chat Panel Rendering",
  component: ChatPanel,
  parameters: { layout: "fullscreen", controls: { disable: true } },
  tags: ["!manifest"],
};
export default meta;
type Story = StoryObj<typeof ChatPanel>;

function RenderingBenchmark() {
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [identity, setIdentity] = useState("primary");
  const [hidden, setHidden] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const streamCount = useRef(0);

  const mount = (name: string) => {
    setIdentity(name);
    setMessages(chatRenderingFixtures[name]);
    setStreaming(false);
    setHidden(false);
    streamCount.current = 0;
  };
  const stream = async () => {
    streamCount.current += 1;
    const suffix = streamCount.current === 1 ? "" : `-${streamCount.current}`;
    setStreaming(true);
    await streamMessages({
      messages: renderingStreamTail.map((message) => ({ ...message, id: message.id + suffix })),
      isCancelled: () => false,
      appendMessage: (message) => setMessages((current) => [...current, message]),
      updateText: (messageId, partIndex, text) =>
        setMessages((current) => updateStreamingTextPart(current, messageId, partIndex, text)),
    });
    setStreaming(false);
    markAfterPaint("chat-rendering:stream-complete");
  };

  return (
    <Box h="100vh" display="flex" flexDirection="column">
      <HStack flexWrap="wrap" p="sm">
        {Object.keys(chatRenderingFixtures).map((name) => (
          <Button key={name} onClick={() => mount(name)}>
            {name}
          </Button>
        ))}
        <Button onClick={() => setIdentity((current) => (current === "secondary" ? "primary" : "secondary"))}>
          Switch session
        </Button>
        <Button onClick={() => setHidden((current) => !current)}>{hidden ? "Show chat" : "Hide chat"}</Button>
        <Button onClick={() => void stream()} disabled={streaming}>
          Stream response
        </Button>
      </HStack>
      <Box flex="1" minH="0" display={hidden ? "none" : "block"} data-testid="rendering-chat">
        <ChatPanel conversationKey={identity} messages={messages} streaming={streaming} {...defaultChatPanelProps} />
      </Box>
    </Box>
  );
}

export const RenderingWorkloads: Story = { render: () => <RenderingBenchmark /> };

export const LongTurnScrolling: Story = {
  render: RenderingWorkloads.render,
  play: validateLongTurnRendering,
};

export const ContinuousScrolling: Story = {
  render: RenderingWorkloads.render,
  play: validateContinuousChatScroll,
};
