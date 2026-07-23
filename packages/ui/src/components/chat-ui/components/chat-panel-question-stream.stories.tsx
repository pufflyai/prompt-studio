import { Box, Button, HStack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useRef, useState } from "react";
import type { ChatInputQuestionPrompt } from "./chat-input-question-prompt";
import { ChatPanel } from "./chat-panel";
import type { SessionMessage, ToolPart } from "./message-types";

const meta: Meta<typeof ChatPanel> = {
  title: "Patterns/Chat/Chat Panel/Question Stream",
  component: ChatPanel,
  parameters: {
    layout: "padded",
  },
};

export default meta;

type Story = StoryObj<typeof ChatPanel>;

const panelContainerStyles = {
  w: "960px",
  maxW: "100%",
  h: "680px",
  bg: "bg",
  borderWidth: "1px",
  borderColor: "border",
  borderRadius: "lg",
  p: "md",
} as const;

const STREAM_CHUNK_SIZE = 9;
const STREAM_INTERVAL_MS = 55;
const QUESTION_MESSAGE_ID = "assistant-question";
const QUESTION_CALL_ID = "question-call-1";
const RESUMED_MESSAGE_ID = "assistant-resumed";

const questionPrompt: ChatInputQuestionPrompt = {
  questions: [
    {
      id: "implementation",
      question: "Which implementation path should I continue with?",
      options: [
        { label: "Minimal patch", description: "Keep the change focused on the question flow." },
        { label: "Refactor first", description: "Clean the surrounding chat structure before continuing." },
      ],
      required: true,
    },
    {
      id: "constraints",
      question: "Which constraints should I apply?",
      options: [
        { label: "Keep API stable", description: "Do not change public contracts." },
        { label: "Add Storybook coverage", description: "Document the user-facing state." },
        { label: "No backend changes", description: "Keep this scoped to UI behavior." },
      ],
      multiple: true,
      required: true,
    },
    {
      id: "notes",
      question: "Any additional notes before I resume?",
      options: [],
      allowCustomAnswer: true,
    },
  ],
};

const initialMessages: SessionMessage[] = [
  {
    id: "user-initial",
    role: "user",
    parts: [
      {
        type: "text",
        text: "Show me how the OpenCode stream pauses when it reaches a Question tool.",
      },
    ],
  },
  {
    id: QUESTION_MESSAGE_ID,
    role: "assistant",
    parts: [{ type: "text", text: "" }],
  },
];

const introText = [
  "I am streaming the response until the Question tool appears.",
  "At that point the stream stops and the input switches to the question form.",
].join(" ");

const buildResumedText = (answer: string) =>
  [
    "Answer submitted. I can now resume the OpenCode conversation with that response.",
    "",
    answer,
    "",
    "The previous question is shown as the submitted response instead of the full form, and the assistant stream continues from here.",
  ].join("\n");

const createQuestionToolPart = (answer?: string): ToolPart => ({
  type: "tool",
  tool: "Question",
  callId: QUESTION_CALL_ID,
  status: answer ? "completed" : "pending",
  state: {
    status: answer ? "completed" : "pending",
    input: questionPrompt,
    output: answer,
  },
});

const splitTextIntoChunks = (text: string) => {
  const chunks: string[] = [];

  for (let index = 0; index < text.length; index += STREAM_CHUNK_SIZE) {
    chunks.push(text.slice(index, index + STREAM_CHUNK_SIZE));
  }

  return chunks;
};

const clearStreamTimer = (timerRef: { current: ReturnType<typeof setInterval> | null }) => {
  if (timerRef.current === null) return;

  clearInterval(timerRef.current);
  timerRef.current = null;
};

const updateAssistantTextPart = (messages: SessionMessage[], messageId: string, text: string) =>
  messages.map((message) => {
    if (message.id !== messageId) return message;

    const firstPart = message.parts[0];
    if (!firstPart || firstPart.type !== "text") return message;

    return {
      ...message,
      parts: [{ ...firstPart, text }, ...message.parts.slice(1)],
    };
  });

const appendQuestionTool = (messages: SessionMessage[]) =>
  messages.map((message) => {
    if (message.id !== QUESTION_MESSAGE_ID) return message;

    return {
      ...message,
      parts: [...message.parts, createQuestionToolPart()],
    };
  });

const completeQuestionTool = (messages: SessionMessage[], answer: string) =>
  messages.map((message) => ({
    ...message,
    parts: message.parts.map((part) => {
      if (part.type !== "tool" || part.callId !== QUESTION_CALL_ID) return part;

      return createQuestionToolPart(answer);
    }),
  }));

const streamText = (options: {
  timerRef: { current: ReturnType<typeof setInterval> | null };
  sourceText: string;
  onStart: () => void;
  onChunk: (text: string) => void;
  onComplete: () => void;
}) => {
  const { timerRef, sourceText, onStart, onChunk, onComplete } = options;
  const chunks = splitTextIntoChunks(sourceText);
  let streamedText = "";
  let chunkIndex = 0;

  clearStreamTimer(timerRef);
  onStart();

  timerRef.current = setInterval(() => {
    streamedText += chunks[chunkIndex] ?? "";
    onChunk(streamedText);
    chunkIndex += 1;

    if (chunkIndex < chunks.length) return;

    clearStreamTimer(timerRef);
    onComplete();
  }, STREAM_INTERVAL_MS);
};

function QuestionInterruptedStreamRenderer() {
  const [messages, setMessages] = useState<SessionMessage[]>(initialMessages);
  const [streaming, setStreaming] = useState(true);
  const [activeQuestionPrompt, setActiveQuestionPrompt] = useState<ChatInputQuestionPrompt>();
  const streamTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setMessages(initialMessages);
    setActiveQuestionPrompt(undefined);

    streamText({
      timerRef: streamTimerRef,
      sourceText: introText,
      onStart: () => setStreaming(true),
      onChunk: (text) => setMessages((current) => updateAssistantTextPart(current, QUESTION_MESSAGE_ID, text)),
      onComplete: () => {
        setMessages((current) => appendQuestionTool(current));
        setActiveQuestionPrompt(questionPrompt);
        setStreaming(false);
      },
    });

    return () => clearStreamTimer(streamTimerRef);
  }, []);

  const handleSubmitMessage = (text: string, attachments: string[]) => {
    const userMessage: SessionMessage = {
      id: "user-answer",
      role: "user",
      parts: [{ type: "text", text }],
    };
    const assistantMessage: SessionMessage = {
      id: RESUMED_MESSAGE_ID,
      role: "assistant",
      parts: [{ type: "text", text: "" }],
    };

    console.log("Submitted answer", { text, attachments });
    setActiveQuestionPrompt(undefined);
    setMessages((current) => [...completeQuestionTool(current, text), userMessage, assistantMessage]);

    streamText({
      timerRef: streamTimerRef,
      sourceText: buildResumedText(text),
      onStart: () => setStreaming(true),
      onChunk: (nextText) => setMessages((current) => updateAssistantTextPart(current, RESUMED_MESSAGE_ID, nextText)),
      onComplete: () => setStreaming(false),
    });
  };

  return (
    <ChatPanel
      messages={messages}
      streaming={streaming}
      emptyStateTitle="No active conversations"
      emptyStateDescription="The stream will start automatically."
      chatInputPlaceholder="Answer the question..."
      chatInputQuestionPrompt={activeQuestionPrompt}
      onSubmitMessage={handleSubmitMessage}
      actions={
        <HStack gap="2">
          <Button size="xs" variant="subtle">
            OpenCode
          </Button>
          <Button size="xs" variant="subtle">
            Question stream
          </Button>
        </HStack>
      }
    />
  );
}

export const StopsAtQuestionAndResumes: Story = {
  render: () => (
    <Box {...panelContainerStyles}>
      <QuestionInterruptedStreamRenderer />
    </Box>
  ),
};
