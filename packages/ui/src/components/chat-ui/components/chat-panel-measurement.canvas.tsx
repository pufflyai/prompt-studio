import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { ChatPanel } from "./chat-panel";
import type { SessionMessage } from "./message-types";

const MeasuredChatStory = () => {
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  return (
    <Box h="96" w="full" maxW="container.sm">
      <ChatPanel
        messages={messages}
        emptyStateTitle="No messages yet"
        emptyStateDescription="Send a message to start this session."
        chatInputPlaceholder="Reply to the agent..."
        onSubmitMessage={(text) => {
          setMessages((current) => [
            ...current,
            { id: `message-${current.length}`, role: "user", parts: [{ type: "text", text }] },
          ]);
        }}
      />
    </Box>
  );
};
const meta: CanvasMeta<typeof MeasuredChatStory> = {
  title: "Patterns/Chat/Measurement",
  component: MeasuredChatStory,
};
export default meta;
export const SendMessage: CanvasFrame<typeof meta> = {
  id: "patterns-chat-measurement--send-message",
};
