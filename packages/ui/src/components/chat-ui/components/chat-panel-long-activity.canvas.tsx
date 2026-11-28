import { Box, Button, Stack } from "@chakra-ui/react";
import { useState } from "react";
import { ChatPanel } from "./chat-panel";
import type { ChatMessagePart, SessionMessage } from "./message-types";

const activity = Array.from({ length: 200 }, (_, index): ChatMessagePart[] => [
  {
    type: "reasoning",
    text: `Reasoning step ${index + 1}. I reviewed the available files and checked the results before continuing to the next step.`,
  },
  {
    type: "tool",
    tool: "bash",
    callId: `call-${index + 1}`,
    status: "completed",
    state: { input: { command: `ls src/step-${index + 1}` }, output: `Found module ${index + 1}` },
  },
]);
const answer = { type: "text", text: "The review is complete." } as const;
const messages = (oneMessage: boolean): SessionMessage[] => [
  { id: "prompt", role: "user", parts: [{ type: "text", text: "Review the workspace." }] },
  ...(oneMessage
    ? []
    : activity.map((parts, index): SessionMessage => ({ id: `activity-${index}`, role: "assistant", parts }))),
  { id: "answer", role: "assistant", parts: oneMessage ? [...activity.flat(), answer] : [answer] },
];

export default {
  title: "Design system/Patterns/Chat/Chat panel long activity",
  fullscreen: true,
};

export const LongActivity = () => {
  const [oneMessage, setOneMessage] = useState(false);
  return (
    <Stack w="900px" maxW="full" gap="sm" align="start">
      <Button size="xs" onClick={() => setOneMessage((current) => !current)}>
        {oneMessage ? "Replay separate messages" : "Replay one message"}
      </Button>
      <Box display="flex" w="full" h="1000px">
        <ChatPanel
          conversationKey={oneMessage ? "single" : "separate"}
          messages={messages(oneMessage)}
          hideComposer
          emptyStateTitle="No messages"
          emptyStateDescription="Send a message."
          chatInputPlaceholder="Reply..."
        />
      </Box>
    </Stack>
  );
};
