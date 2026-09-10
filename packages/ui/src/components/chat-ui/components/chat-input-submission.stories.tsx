import { Box, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { createSerializedPromptState } from "../utils/editor-state";
import { ChatInput } from "./chat-input";

const StreamingComposer = (props: { fail?: boolean }) => {
  const { fail } = props;
  const [messages, setMessages] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(true);
  return (
    <Box w="full">
      <ChatInput
        defaultState={createSerializedPromptState("")}
        streaming={streaming}
        onInterrupt={() => setStreaming(false)}
        onSubmit={async (text) => {
          if (fail) throw new Error("Submission failed");
          setMessages((current) => [...current, text]);
        }}
      />
      <Text>{streaming ? "Current turn is running" : "Response stopped"}</Text>
      {messages.map((message, index) => (
        <Text key={`${index}-${message}`}>Waiting: {message}</Text>
      ))}
    </Box>
  );
};
const meta = { title: "Patterns/Chat/Follow-up submission", component: StreamingComposer } satisfies Meta<
  typeof StreamingComposer
>;
export default meta;
export const QueueWhileRunning: StoryObj<typeof meta> = {};
export const KeepFailedDraft: StoryObj<typeof meta> = { args: { fail: true } };
