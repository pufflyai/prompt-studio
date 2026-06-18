import { Box, Button, HStack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { type ComponentProps, useEffect, useRef, useState } from "react";
import rawConversationMessages from "../mocks/full-conversation-normalized.json";
import { ChatPanel } from "./chat-panel";
import type { SessionMessage } from "./message-types";
import { ChatWorkspaceHub } from "./workspace-hub";

const conversationMessages = rawConversationMessages as unknown as SessionMessage[];

const longUserPrompt = [
  "I need a release checklist for this rollout and I want every detail captured in one place.",
  "Include pre-flight checks for database migrations, message queue lag, worker health, API latency budgets, and frontend error budgets.",
  "Add rollback steps with exact ownership, communication templates, and what metrics should trigger rollback automatically.",
  "Also include a section that explains canary rollout percentages by minute, regional sequencing, and how we handle failed verification gates.",
  "Please include dry-run instructions, expected command outputs, and post-deploy validation checks for auth, billing, and audit logs.",
  "Finally, provide a handoff note that the on-call engineer can use without extra context, including escalation paths and paging thresholds.",
].join(" ");

const longPromptMessages: SessionMessage[] = [
  {
    id: "long-user-prompt",
    role: "user",
    parts: [{ type: "text", text: `${longUserPrompt} ${longUserPrompt}` }],
  },
  {
    id: "assistant-response-after-long-prompt",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "Acknowledged. I created a compact rollout checklist with owners, rollback triggers, and post-deploy validation steps so the response stays visible while you review the prompt.",
      },
    ],
  },
];

const meta: Meta<typeof ChatPanel> = {
  title: "Patterns/Chat/Chat Panel",
  component: ChatPanel,
  parameters: {
    layout: "padded",
    actions: { argTypesRegex: "^on[A-Z].*" },
  },
};

export default meta;

type Story = StoryObj<typeof ChatPanel>;
type ChatPanelProps = ComponentProps<typeof ChatPanel>;

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

const defaultActions = (
  <HStack gap="2">
    <Button size="xs" variant="subtle">
      Opencode
    </Button>
    <Button size="xs" variant="subtle">
      GPT-5.3 Codex
    </Button>
  </HStack>
);

const defaultRepoMenu = (
  <HStack gap="2">
    <Text textStyle="label/S/medium" color="fg.muted">
      mono
    </Text>
    <Button size="xs" variant="ghost">
      main
    </Button>
  </HStack>
);

const streamingMessages = conversationMessages.slice(-18);
const STREAM_CHUNK_SIZE = 10;
const STREAM_INTERVAL_MS = 60;

const splitTextIntoChunks = (text: string) => {
  if (!text) return [];

  const chunks: string[] = [];

  for (let index = 0; index < text.length; index += STREAM_CHUNK_SIZE) {
    chunks.push(text.slice(index, index + STREAM_CHUNK_SIZE));
  }

  return chunks;
};

const isTextPart = (part: SessionMessage["parts"][number]): part is { type: "text"; text: string } => {
  return part.type === "text";
};

const updateAssistantTextPart = (
  currentMessages: SessionMessage[],
  messageId: string,
  partIndex: number,
  text: string,
) => {
  return currentMessages.map((message) => {
    if (message.id !== messageId) return message;

    const targetPart = message.parts[partIndex];
    if (!targetPart || !isTextPart(targetPart)) return message;

    const nextParts = [...message.parts];
    nextParts[partIndex] = { ...targetPart, text };

    return {
      ...message,
      parts: nextParts,
    };
  });
};

type TextPartEntry = { part: { type: "text"; text: string }; idx: number };

const getTextPartEntries = (message: SessionMessage) => {
  return message.parts
    .map((part, idx) => ({ part, idx }))
    .filter(({ part }) => isTextPart(part) && part.text.trim().length > 0) as TextPartEntry[];
};

const seedTextParts = (message: SessionMessage, textPartEntries: TextPartEntry[]) => {
  const textPartIndexes = new Set(textPartEntries.map(({ idx }) => idx));
  return {
    ...message,
    parts: message.parts.map((part, idx) =>
      textPartIndexes.has(idx) && isTextPart(part) ? { ...part, text: "" } : part,
    ),
  } satisfies SessionMessage;
};

const streamTextParts = async (options: {
  message: SessionMessage;
  textPartEntries: TextPartEntry[];
  isCancelled: () => boolean;
  onChunk: (messageId: string, partIndex: number, text: string) => void;
}) => {
  const { message, textPartEntries, isCancelled, onChunk } = options;

  for (const { part, idx } of textPartEntries) {
    if (isCancelled()) return;

    const chunks = splitTextIntoChunks(part.text);
    let streamed = "";

    for (const chunk of chunks) {
      if (isCancelled()) return;
      streamed += chunk;
      onChunk(message.id, idx, streamed);
      await delay(STREAM_INTERVAL_MS);
    }
  }
};

const streamConversationMessages = async (options: {
  messages: SessionMessage[];
  isCancelled: () => boolean;
  onStart: () => void;
  onMessage: (message: SessionMessage) => void;
  onChunk: (messageId: string, partIndex: number, text: string) => void;
  onComplete: () => void;
}) => {
  const { messages, isCancelled, onStart, onMessage, onChunk, onComplete } = options;

  onStart();

  for (const message of messages) {
    if (isCancelled()) return;

    const textPartEntries = getTextPartEntries(message);
    if (textPartEntries.length === 0) {
      onMessage(message);

      const pauseMs =
        message.role === "user" ? CONVERSATION_STREAM_MESSAGE_DELAY_MS : CONVERSATION_STREAM_STEP_DELAY_MS;
      await delay(pauseMs);
      continue;
    }

    onMessage(seedTextParts(message, textPartEntries));
    await streamTextParts({ message, textPartEntries, isCancelled, onChunk });
    await delay(CONVERSATION_STREAM_MESSAGE_DELAY_MS);
  }

  if (!isCancelled()) onComplete();
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const CONVERSATION_STREAM_MESSAGE_DELAY_MS = 200;
const CONVERSATION_STREAM_STEP_DELAY_MS = 80;

const clearStreamTimer = (timerRef: { current: ReturnType<typeof setInterval> | null }) => {
  if (timerRef.current === null) return;

  clearInterval(timerRef.current);
  timerRef.current = null;
};

const streamAssistantText = (options: {
  timerRef: { current: ReturnType<typeof setInterval> | null };
  sourceText: string;
  onStart: () => void;
  onChunk: (nextText: string) => void;
  onComplete: () => void;
}) => {
  const { timerRef, sourceText, onStart, onChunk, onComplete } = options;

  clearStreamTimer(timerRef);

  const chunks = splitTextIntoChunks(sourceText);
  if (chunks.length === 0) {
    onComplete();
    return;
  }

  let streamedText = "";
  let chunkIndex = 0;

  onStart();

  timerRef.current = setInterval(() => {
    streamedText += chunks[chunkIndex] ?? "";
    onChunk(streamedText);

    chunkIndex += 1;

    if (chunkIndex >= chunks.length) {
      clearStreamTimer(timerRef);
      onComplete();
    }
  }, STREAM_INTERVAL_MS);
};

const buildMockAssistantReply = (text: string, attachments: string[]) => {
  if (attachments.length === 0) {
    return `Mock response: I received "${text}" and generated a draft answer.`;
  }

  return `Mock response: I received "${text}" with ${attachments.length} attachment(s): ${attachments.join(", ")}.`;
};

function MockChatPanelRenderer(props: ChatPanelProps) {
  const {
    messages: initialMessages = [],
    onSubmitMessage,
    emptyStateTitle,
    emptyStateDescription,
    chatInputPlaceholder,
    actions,
    repoMenu,
    workspaceHub,
  } = props;

  const [messages, setMessages] = useState<SessionMessage[]>(initialMessages);
  const [streaming, setStreaming] = useState(false);
  const [nextMessageNumber, setNextMessageNumber] = useState(initialMessages.length + 1);
  const streamTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    clearStreamTimer(streamTimerRef);
    setMessages(initialMessages);
    setNextMessageNumber(initialMessages.length + 1);
  }, [initialMessages]);

  useEffect(() => {
    return () => clearStreamTimer(streamTimerRef);
  }, []);

  const handleSubmitMessage = (text: string, attachments: string[]) => {
    onSubmitMessage?.(text, attachments);

    const userMessage: SessionMessage = {
      id: `message-${nextMessageNumber}`,
      role: "user",
      parts: [{ type: "text", text }],
    };

    const assistantReply = buildMockAssistantReply(text, attachments);
    const assistantMessageId = `message-${nextMessageNumber + 1}`;
    const assistantMessage: SessionMessage = {
      id: assistantMessageId,
      role: "assistant",
      parts: [{ type: "text", text: "" }],
    };

    setNextMessageNumber((current) => current + 2);
    setMessages((current) => [...current, userMessage, assistantMessage]);
    streamAssistantText({
      timerRef: streamTimerRef,
      sourceText: assistantReply,
      onStart: () => setStreaming(true),
      onChunk: (nextText) => {
        setMessages((current) => updateAssistantTextPart(current, assistantMessageId, 0, nextText));
      },
      onComplete: () => setStreaming(false),
    });
  };

  return (
    <ChatPanel
      messages={messages}
      streaming={streaming}
      emptyStateTitle={emptyStateTitle}
      emptyStateDescription={emptyStateDescription}
      chatInputPlaceholder={chatInputPlaceholder}
      onSubmitMessage={handleSubmitMessage}
      actions={actions}
      repoMenu={repoMenu}
      workspaceHub={workspaceHub}
    />
  );
}

export const Empty: Story = {
  render: (args) => (
    <Box {...panelContainerStyles}>
      <MockChatPanelRenderer {...args} />
    </Box>
  ),
  args: {
    messages: [],
    streaming: false,
    emptyStateTitle: "No active conversations",
    emptyStateDescription: "Start a conversation to see messages here.",
    chatInputPlaceholder: "Type a message...",
    actions: defaultActions,
    repoMenu: defaultRepoMenu,
    onSubmitMessage: (text: string, attachments: string[]) => {
      console.log("Submitted", { text, attachments });
    },
  },
};

export const Conversation: Story = {
  render: (args) => (
    <Box {...panelContainerStyles}>
      <MockChatPanelRenderer {...args} />
    </Box>
  ),
  args: {
    ...Empty.args,
    messages: conversationMessages,
  },
};

function StreamingConversationRenderer(props: ChatPanelProps) {
  const {
    messages: allMessages = [],
    emptyStateTitle,
    emptyStateDescription,
    chatInputPlaceholder,
    actions,
    repoMenu,
  } = props;

  const [visibleMessages, setVisibleMessages] = useState<SessionMessage[]>([]);
  const [streaming, setStreaming] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await streamConversationMessages({
        messages: allMessages,
        isCancelled: () => cancelled,
        onStart: () => {
          setVisibleMessages([]);
          setStreaming(true);
        },
        onMessage: (message) => {
          setVisibleMessages((prev) => [...prev, message]);
        },
        onChunk: (messageId, partIndex, text) => {
          setVisibleMessages((prev) => updateAssistantTextPart(prev, messageId, partIndex, text));
        },
        onComplete: () => {
          setStreaming(false);
        },
      });
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [allMessages]);

  return (
    <ChatPanel
      messages={visibleMessages}
      streaming={streaming}
      emptyStateTitle={emptyStateTitle}
      emptyStateDescription={emptyStateDescription}
      chatInputPlaceholder={chatInputPlaceholder}
      actions={actions}
      repoMenu={repoMenu}
    />
  );
}

export const Streaming: Story = {
  render: (args) => (
    <Box {...panelContainerStyles}>
      <StreamingConversationRenderer {...args} />
    </Box>
  ),
  args: {
    ...Empty.args,
    messages: streamingMessages,
  },
};

export const LongStickyUserPrompt: Story = {
  render: (args) => (
    <Box {...panelContainerStyles}>
      <MockChatPanelRenderer {...args} />
    </Box>
  ),
  args: {
    ...Empty.args,
    messages: longPromptMessages,
  },
};

export const ConversationWithWorkspaceHub: Story = {
  render: (args) => (
    <Box {...panelContainerStyles}>
      <MockChatPanelRenderer {...args} />
    </Box>
  ),
  args: {
    ...Conversation.args,
    streaming: true,
    workspaceHub: (
      <ChatWorkspaceHub
        changesLabel="9 files changed"
        additions={83}
        deletions={9}
        action={
          <Button size="sm" variant="plain">
            Review changes
          </Button>
        }
      />
    ),
  },
};
