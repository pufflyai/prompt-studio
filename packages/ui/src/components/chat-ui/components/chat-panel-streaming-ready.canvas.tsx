import { Box, Button, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useEffect, useState } from "react";
import { ChatPanel } from "./chat-panel";
import type { SessionMessage } from "./message-types";

const initialText = Array.from({ length: 12 }, (_, index) => `Earlier paragraph ${index + 1}.`).join("\n\n");
function StreamingOnOpen() {
  const [text, setText] = useState(initialText);
  const [status, setStatus] = useState<"closed" | "streaming" | "stopped">("closed");
  const streaming = status === "streaming";
  useEffect(() => {
    if (!streaming) return;
    let frame = 0;
    let chunk = 0;
    const append = () => {
      chunk += 1;
      const paragraph = `New paragraph ${chunk}.`;
      setText((current) => `${current}\n\n${paragraph}`);
      frame = requestAnimationFrame(append);
    };
    frame = requestAnimationFrame(append);
    return () => cancelAnimationFrame(frame);
  }, [streaming]);
  const messages: SessionMessage[] = [
    { id: "prompt", role: "user", parts: [{ type: "text", text: "Continue the review." }] },
    { id: "response", role: "assistant", parts: [{ type: "text", text }] },
  ];
  return (
    <Stack h="680px" w="420px" maxW="full">
      <Button onClick={() => setStatus("streaming")} disabled={status !== "closed"}>
        Open streaming conversation
      </Button>
      <Button onClick={() => setStatus("stopped")}>Stop stream</Button>
      <Box flex="1" minH="0">
        {status !== "closed" ? (
          <ChatPanel
            conversationKey="streaming-on-open"
            messages={messages}
            streaming={streaming}
            emptyStateTitle="No messages"
            emptyStateDescription="Send a message."
            chatInputPlaceholder="Reply to the review..."
          />
        ) : null}
      </Box>
    </Stack>
  );
}
const meta = {
  title: "Patterns/Chat/Chat Panel Streaming Ready",
  component: StreamingOnOpen,
  fullscreen: true,
} satisfies CanvasMeta<typeof StreamingOnOpen>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const OpensDuringContinuousStream: Story = {
  id: "patterns-chat-chat-panel-streaming-ready--opens-during-continuous-stream",
};
