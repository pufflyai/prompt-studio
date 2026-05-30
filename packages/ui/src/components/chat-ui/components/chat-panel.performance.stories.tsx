import { Button, HStack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useRef, useState } from "react";
import type { SessionMessage } from "../agent-types";
import { startChatMountMetric } from "../performance/chat-mount-metrics";
import {
  buildChatSessionSwitchFixture,
  buildLargeChatConversation,
  CHAT_PERFORMANCE_STRESS_TURNS,
  updateStreamingTextPart,
} from "../performance/chat-performance-fixtures";
import {
  type ActiveMountMeasurement,
  ChatMountReadyMarker,
  ChatPerfShell,
  defaultChatPanelProps,
  markAfterPaint,
  nextFrame,
  streamMessages,
} from "../performance/chat-performance-story-utils";
import { ChatPanel } from "./chat-panel";
import { ChatSkeleton } from "./chat-skeleton";

const meta: Meta<typeof ChatPanel> = {
  title: "Patterns/Chat/Chat Panel Performance",
  component: ChatPanel,
  parameters: {
    layout: "fullscreen",
    controls: { disable: true },
  },
};

export default meta;

type Story = StoryObj<typeof ChatPanel>;

const largeConversation = buildLargeChatConversation({
  sessionId: "perf-large",
  turns: CHAT_PERFORMANCE_STRESS_TURNS,
  textRepeat: 4,
  toolCallsPerTurn: 3,
});

const switchFixture = buildChatSessionSwitchFixture();
const streamingTailTurns = 3;
const streamingSeed = buildLargeChatConversation({
  sessionId: "perf-stream-seed",
  turns: CHAT_PERFORMANCE_STRESS_TURNS - streamingTailTurns,
  textRepeat: 1,
  toolCallsPerTurn: 2,
});
const streamingTail = buildLargeChatConversation({
  sessionId: "perf-stream-tail",
  turns: streamingTailTurns,
  textRepeat: 1,
  toolCallsPerTurn: 2,
});

function LargeConversationBenchmark() {
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [mountMeasurement, setMountMeasurement] = useState<ActiveMountMeasurement | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;

    const run = async () => {
      await nextFrame();
      if (cancelled) return;

      const id = startChatMountMetric({
        scenario: "large-conversation",
        label: "Large chat mount",
        messageCount: largeConversation.length,
        startMarkName: "chat-perf:large-conversation-mount-start",
      });

      setMountMeasurement({ id, readyMarkName: "chat-perf:large-conversation-ready" });
      setMessages(largeConversation);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ChatPerfShell scenario="large-conversation" activeLabel="Large conversation" messageCount={messages.length}>
      <ChatMountReadyMarker measurement={mountMeasurement} messageCount={messages.length} />
      <ChatPanel
        messages={messages}
        loading={messages.length === 0}
        streaming={false}
        loaderComponent={<ChatSkeleton />}
        {...defaultChatPanelProps}
      />
    </ChatPerfShell>
  );
}

function SessionSwitchingBenchmark() {
  const [activeSession, setActiveSession] = useState<typeof switchFixture.primarySession | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [mountMeasurement, setMountMeasurement] = useState<ActiveMountMeasurement | null>(null);
  const startedRef = useRef(false);
  const loadRequestRef = useRef(0);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    let cancelled = false;

    const run = async () => {
      await nextFrame();
      if (cancelled || loadRequestRef.current !== requestId) return;

      const session = switchFixture.primarySession;
      const id = startChatMountMetric({
        scenario: "session-switching",
        label: "Initial session mount",
        messageCount: session.messages.length,
      });

      setMountMeasurement({ id, readyMarkName: "chat-perf:session-switch-ready" });
      setActiveSession(session);
      setIsLoadingSession(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  const switchSession = (session: typeof switchFixture.primarySession) => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    const id = startChatMountMetric({
      scenario: "session-switching",
      label: `${session.label} switch`,
      messageCount: session.messages.length,
      startMarkName: "chat-perf:session-switch-start",
    });

    setMountMeasurement({ id, readyMarkName: "chat-perf:session-switch-ready" });
    setIsLoadingSession(true);
    setActiveSession(null);

    const run = async () => {
      await nextFrame();
      if (loadRequestRef.current !== requestId) return;

      setActiveSession(session);
      setIsLoadingSession(false);
    };

    void run();
  };

  const controls = (
    <HStack gap="xs">
      <Button size="xs" onClick={() => switchSession(switchFixture.primarySession)}>
        Primary
      </Button>
      <Button size="xs" onClick={() => switchSession(switchFixture.secondarySession)}>
        Secondary
      </Button>
    </HStack>
  );

  const messages = activeSession?.messages ?? [];

  return (
    <ChatPerfShell
      scenario="session-switching"
      activeLabel={activeSession?.label ?? "Loading session"}
      messageCount={messages.length}
      actions={controls}
    >
      <ChatMountReadyMarker measurement={mountMeasurement} messageCount={messages.length} />
      <ChatPanel
        messages={messages}
        loading={isLoadingSession}
        streaming={false}
        loaderComponent={<ChatSkeleton />}
        {...defaultChatPanelProps}
      />
    </ChatPerfShell>
  );
}

function StreamingBenchmark() {
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [mountMeasurement, setMountMeasurement] = useState<ActiveMountMeasurement | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;

    const run = async () => {
      await nextFrame();
      if (cancelled) return;

      const id = startChatMountMetric({
        scenario: "streaming",
        label: "Seed chat mount",
        messageCount: streamingSeed.length,
      });

      setMountMeasurement({ id });
      setMessages(streamingSeed);
      setStreaming(true);

      await nextFrame();
      await nextFrame();

      performance.mark("chat-perf:stream-start");

      await streamMessages({
        messages: streamingTail,
        isCancelled: () => cancelled,
        appendMessage: (message) => setMessages((current) => [...current, message]),
        updateText: (messageId, partIndex, text) =>
          setMessages((current) => updateStreamingTextPart(current, messageId, partIndex, text)),
      });

      if (cancelled) return;

      setStreaming(false);
      markAfterPaint("chat-perf:stream-complete");
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ChatPerfShell scenario="streaming" activeLabel="Streaming conversation" messageCount={messages.length}>
      <ChatMountReadyMarker measurement={mountMeasurement} messageCount={messages.length} />
      <ChatPanel
        messages={messages}
        loading={messages.length === 0}
        streaming={streaming}
        loaderComponent={<ChatSkeleton />}
        {...defaultChatPanelProps}
      />
    </ChatPerfShell>
  );
}

export const LargeConversation: Story = {
  render: () => <LargeConversationBenchmark />,
};

export const SessionSwitching: Story = {
  render: () => <SessionSwitchingBenchmark />,
};

export const StreamingScenario: Story = {
  render: () => <StreamingBenchmark />,
};
