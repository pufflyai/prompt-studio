import { Box } from "@chakra-ui/react";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { ChatPanel, ChatSkeleton } from "@pstdio/ui/chat-ui";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { createPendingFollowUpState, mergeMessagesWithPendingFollowUp } from "./session-chat-state";

const mockMessages: SessionMessage[] = [
  {
    id: "msg-1",
    role: "user",
    parts: [{ type: "text", text: "Fix the failing tests in the auth module" }],
  },
  {
    id: "msg-2",
    role: "assistant",
    parts: [
      { type: "text", text: "I'll look at the failing tests in the auth module and fix them." },
      { type: "tool", tool: "Read", status: "completed", state: { input: "src/auth/auth.test.ts" } },
      {
        type: "text",
        text: "Found the issue. The test was comparing against a stale mock. I've updated the mock data.",
      },
    ],
  },
];

const pendingFollowUp = mergeMessagesWithPendingFollowUp(
  mockMessages,
  createPendingFollowUpState({
    prompt: "Can you validate the fix and send an update?",
    messageCount: mockMessages.length,
    pendingId: "pending-follow-up",
  }),
);

const pendingFirstMessage = mergeMessagesWithPendingFollowUp(
  [],
  createPendingFollowUpState({
    prompt: "Help me investigate the flaky CI failure.",
    messageCount: 0,
    pendingId: "pending-first-message",
  }),
);

const meta: Meta = {
  title: "Sessions/SessionChatView",
  parameters: { layout: "padded" },
};

export default meta;

type Story = StoryObj;

interface LocalizedChatPanelProps {
  emptyStateDescriptionKey?: string;
  emptyStateTitleKey: string;
  loadingContent?: ReactNode;
  messages: SessionMessage[];
  streaming: boolean;
}

const LocalizedChatPanel = (props: LocalizedChatPanelProps) => {
  const { emptyStateDescriptionKey, emptyStateTitleKey, loadingContent, messages, streaming } = props;
  const { t } = useTranslation("projects");

  return (
    <Box w="720px" h="500px" borderWidth="1px" borderRadius="lg">
      <ChatPanel
        messages={messages}
        streaming={streaming}
        emptyStateTitle={t(emptyStateTitleKey)}
        emptyStateDescription={emptyStateDescriptionKey ? t(emptyStateDescriptionKey) : ""}
        chatInputPlaceholder={t("sessions.followUpPlaceholder")}
        loadingContent={loadingContent}
      />
    </Box>
  );
};

export const WithMessages: Story = {
  render: () => (
    <LocalizedChatPanel
      messages={mockMessages}
      streaming={false}
      emptyStateTitleKey="sessions.noSessionSelected"
      emptyStateDescriptionKey="sessions.selectSession"
    />
  ),
};

export const WithPendingFollowUp: Story = {
  render: () => (
    <LocalizedChatPanel
      messages={pendingFollowUp}
      streaming
      emptyStateTitleKey="sessions.noSessionSelected"
      emptyStateDescriptionKey="sessions.selectSession"
    />
  ),
};

export const LoadingConversation: Story = {
  render: () => (
    <LocalizedChatPanel
      messages={[]}
      streaming
      loadingContent={<ChatSkeleton />}
      emptyStateTitleKey="sessions.noSessionSelected"
      emptyStateDescriptionKey="sessions.selectSession"
    />
  ),
};

export const StartingNewSession: Story = {
  render: () => (
    <LocalizedChatPanel messages={pendingFirstMessage} streaming emptyStateTitleKey="sessions.nextBuildTitle" />
  ),
};

export const NewSession: Story = {
  render: () => <LocalizedChatPanel messages={[]} streaming={false} emptyStateTitleKey="sessions.nextBuildTitle" />,
};

export const ConversationUnavailable: Story = {
  render: () => (
    <LocalizedChatPanel
      messages={[]}
      streaming={false}
      emptyStateTitleKey="chatInput.session.notFoundTitle"
      emptyStateDescriptionKey="chatInput.session.notFoundDescription"
    />
  ),
};
