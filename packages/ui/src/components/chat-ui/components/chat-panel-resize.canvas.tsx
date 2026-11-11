import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useEffect, useState } from "react";
import { ChatPanel } from "./chat-panel";
import type { SessionMessage } from "./message-types";

function ResizingConversation() {
  const [count, setCount] = useState(2);
  const [wide, setWide] = useState(false);
  const [streaming, setStreaming] = useState(false);
  useEffect(() => {
    if (!streaming) return;
    let frame = 0;
    let emitted = 0;
    const append = () => {
      setCount((current) => current + 1);
      emitted += 1;
      if (emitted === 28) setStreaming(false);
      else frame = requestAnimationFrame(append);
    };
    frame = requestAnimationFrame(append);
    return () => cancelAnimationFrame(frame);
  }, [streaming]);
  const messages: SessionMessage[] = [
    { id: "prompt", role: "user", parts: [{ type: "text", text: "Replay the workspace review." }] },
    ...Array.from({ length: count }, (_, index) => ({
      id: `step-${index + 1}`,
      role: "assistant" as const,
      parts: [
        {
          type: "text" as const,
          text: `Step ${index + 1}. ${"I read the workspace files, compared them with the plan, and noted what changed. ".repeat(6)}`,
        },
      ],
    })),
  ];
  return (
    <Stack w="1200px" maxW="full" gap="sm">
      <HStack>
        <Button onClick={() => setWide((current) => !current)}>Resize panel</Button>
        <Button
          disabled={streaming}
          onClick={() => {
            setWide((current) => !current);
            setStreaming(true);
          }}
        >
          Resize and stream
        </Button>
        <Button disabled={streaming} onClick={() => setCount((current) => current + 1)}>
          Append response
        </Button>
      </HStack>
      <Text role="status">{streaming ? "Streaming" : `Responses: ${count}`}</Text>
      <Box
        display="flex"
        w={wide ? "1100px" : "380px"}
        h={wide ? "720px" : "400px"}
        transitionProperty="width, height"
        transitionDuration="fast"
      >
        <ChatPanel
          conversationKey="resizing-conversation"
          messages={messages}
          streaming={streaming || count < 30}
          hideComposer
          emptyStateTitle="No messages"
          emptyStateDescription="Send a message."
          chatInputPlaceholder="Reply to the review..."
        />
      </Box>
    </Stack>
  );
}

const meta = {
  title: "Design system/Patterns/Chat/Chat panel resize",
  component: ResizingConversation,
  fullscreen: true,
} satisfies CanvasMeta<typeof ResizingConversation>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const StreamingResize: Story = { id: "patterns-chat-chat-panel-resize--streaming-resize" };
