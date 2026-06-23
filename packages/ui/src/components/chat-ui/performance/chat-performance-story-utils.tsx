import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { Profiler, type ReactNode, useEffect } from "react";
import type { SessionMessage } from "../components/message-types";
import { finishChatMountMetricAfterPaint } from "./chat-mount-metrics";
import { seedStreamingMessage } from "./chat-performance-fixtures";
import { ChatPerformancePanel, ensureChatPerfBuffer } from "./chat-performance-panel";

export const defaultChatPanelProps = {
  emptyStateTitle: "No messages",
  emptyStateDescription: "",
  chatInputPlaceholder: "Benchmark prompt",
} as const;

export type ActiveMountMeasurement = {
  id: string;
  readyMarkName?: string;
};

const panelShellProps = {
  w: "100vw",
  h: "100vh",
  minH: "0",
  bg: "bg",
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr)",
} as const;

export const markAfterPaint = (markName: string) => {
  if (typeof performance === "undefined") return;

  const mark = () => performance.mark(markName);
  if (typeof requestAnimationFrame === "undefined") {
    mark();
    return;
  }

  requestAnimationFrame(() => requestAnimationFrame(mark));
};

export const nextFrame = () =>
  new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === "undefined") {
      resolve();
      return;
    }

    requestAnimationFrame(() => resolve());
  });

const splitText = (text: string, chunkSize: number) => {
  const chunks: string[] = [];

  for (let index = 0; index < text.length; index += chunkSize) {
    chunks.push(text.slice(index, index + chunkSize));
  }

  return chunks;
};

const textPartEntries = (message: SessionMessage) => {
  return message.parts
    .map((part, partIndex) => ({ part, partIndex }))
    .filter(
      (entry): entry is { part: { type: "text"; text: string }; partIndex: number } => entry.part.type === "text",
    );
};

const streamTextEntry = async (input: {
  messageId: string;
  partIndex: number;
  text: string;
  isCancelled: () => boolean;
  updateText: (messageId: string, partIndex: number, text: string) => void;
}) => {
  const { messageId, partIndex, text, isCancelled, updateText } = input;
  let streamedText = "";

  for (const chunk of splitText(text, 384)) {
    if (isCancelled()) return;
    streamedText += chunk;
    updateText(messageId, partIndex, streamedText);
    await nextFrame();
  }
};

const streamMessage = async (input: {
  message: SessionMessage;
  isCancelled: () => boolean;
  appendMessage: (message: SessionMessage) => void;
  updateText: (messageId: string, partIndex: number, text: string) => void;
}) => {
  const { message, isCancelled, appendMessage, updateText } = input;
  const entries = textPartEntries(message);

  if (entries.length === 0) {
    appendMessage(message);
    await nextFrame();
    return;
  }

  appendMessage(seedStreamingMessage(message));
  await nextFrame();

  for (const entry of entries) {
    await streamTextEntry({
      messageId: message.id,
      partIndex: entry.partIndex,
      text: entry.part.text,
      isCancelled,
      updateText,
    });
  }
};

export const streamMessages = async (input: {
  messages: SessionMessage[];
  isCancelled: () => boolean;
  appendMessage: (message: SessionMessage) => void;
  updateText: (messageId: string, partIndex: number, text: string) => void;
}) => {
  for (const message of input.messages) {
    if (input.isCancelled()) return;
    await streamMessage({ ...input, message });
  }
};

export function ChatMountReadyMarker(props: { measurement: ActiveMountMeasurement | null; messageCount: number }) {
  const { measurement, messageCount } = props;

  useEffect(() => {
    if (!measurement || messageCount === 0) return;

    finishChatMountMetricAfterPaint({
      id: measurement.id,
      messageCount,
      readyMarkName: measurement.readyMarkName,
    });
  }, [measurement, messageCount]);

  return null;
}

export function ChatPerfShell(props: {
  scenario: string;
  activeLabel: string;
  messageCount: number;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { scenario, activeLabel, messageCount, actions, children } = props;

  return (
    <Box {...panelShellProps} data-testid="chat-perf-shell" data-scenario={scenario}>
      <HStack
        justify="space-between"
        gap="md"
        px="md"
        py="sm"
        borderBottomWidth="1px"
        borderColor="border"
        bg="bg.subtle"
      >
        <HStack gap="md" align="center" flex="1" minW="0">
          <Stack gap="0" minW="0">
            <Text textStyle="label/S/medium">{activeLabel}</Text>
            <Text textStyle="label/XS/regular" color="fg.muted" data-testid="chat-perf-message-count">
              {messageCount} messages
            </Text>
          </Stack>
          {actions}
        </HStack>
        <ChatPerformancePanel scenario={scenario} messageCount={messageCount} />
      </HStack>
      <Box minH="0" p="md">
        <Profiler
          id={scenario}
          onRender={(id, phase, actualDuration, baseDuration, _startTime, commitTime) => {
            ensureChatPerfBuffer()?.push({ scenario: id, phase, actualDuration, baseDuration, commitTime });
          }}
        >
          {children}
        </Profiler>
      </Box>
    </Box>
  );
}
