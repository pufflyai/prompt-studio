import type { Meta, StoryObj } from "@storybook/react";
import { SessionChatNotices } from "./session-chat-notices";

const meta = {
  title: "Sessions/Chat notices",
  component: SessionChatNotices,
  args: {
    refreshQueue: () => {},
  },
} satisfies Meta<typeof SessionChatNotices>;
export default meta;
type Story = StoryObj<typeof SessionChatNotices>;
export const ConflictingHistory: Story = {
  args: { historyIssue: { code: "reconciliation_conflict", category: "ambiguous_turns" } },
};
export const SavedConversationFallback: Story = {
  args: { historyIssue: { code: "native_unavailable", category: "native_unavailable" } },
};
export const HistoryLoadError: Story = {
  args: { error: "Could not load the conversation." },
};
export const UnreadableSavedHistory: Story = {
  args: { historyIssue: { code: "checkpoint_unreadable", category: "checkpoint_unreadable" } },
};
export const QueueLoadError: Story = {
  args: { queueError: "Could not load queued prompts." },
};
