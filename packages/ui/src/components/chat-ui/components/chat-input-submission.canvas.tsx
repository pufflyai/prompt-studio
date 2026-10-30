import { Box, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";
import { createSerializedPromptState } from "../utils/editor-state";
import { ChatInput } from "./chat-input";

const StreamingComposer = (props: { fail?: boolean; slow?: boolean; question?: boolean }) => {
  const { fail, slow, question } = props;
  const [messages, setMessages] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(true);
  const [pending, setPending] = useState(false);
  return (
    <Box w="full">
      <ChatInput
        defaultState={createSerializedPromptState("Seeded draft")}
        questionPrompt={
          question
            ? {
                questions: [
                  {
                    id: "language",
                    question: "Choose a language",
                    multiple: true,
                    allowCustomAnswer: true,
                    options: [{ label: "TypeScript" }],
                  },
                ],
              }
            : undefined
        }
        streaming={streaming}
        onInterrupt={() => setStreaming(false)}
        onSubmit={async (text) => {
          setPending(true);
          if (!fail) setMessages((current) => [...current, text]);
          if (slow) await new Promise((resolve) => setTimeout(resolve, 1000));
          setPending(false);
          if (fail) throw new Error("Submission failed");
        }}
      />
      <Text>{pending ? "Sending" : "Ready"}</Text>
      <Text>{streaming ? "Current turn is running" : "Response stopped"}</Text>
      {messages.map((message, index) => (
        <Text key={`${index}-${message}`}>Waiting: {message}</Text>
      ))}
    </Box>
  );
};
const meta = { title: "Patterns/Chat/Follow-up submission", component: StreamingComposer } satisfies CanvasMeta<
  typeof StreamingComposer
>;
export default meta;
export const QueueWhileRunning: CanvasVariant<typeof meta> = {
  id: "patterns-chat-follow-up-submission--queue-while-running",
};
export const KeepFailedDraft: CanvasVariant<typeof meta> = {
  id: "patterns-chat-follow-up-submission--keep-failed-draft",
  tags: ["!manifest"],
  args: { fail: true, slow: true },
};
export const SlowSubmission: CanvasVariant<typeof meta> = {
  id: "patterns-chat-follow-up-submission--slow-submission",
  tags: ["!manifest"],
  args: { slow: true },
};
export const KeepFailedQuestionAnswers: CanvasVariant<typeof meta> = {
  id: "patterns-chat-follow-up-submission--keep-failed-question-answers",
  tags: ["!manifest"],
  args: { fail: true, slow: true, question: true },
};
