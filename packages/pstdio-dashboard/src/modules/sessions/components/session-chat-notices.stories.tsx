import type { Meta, StoryObj } from "@storybook/react";
import { SessionChatNotices } from "./session-chat-notices";

const meta = {
  title: "Sessions/Chat notices",
  component: SessionChatNotices,
  args: {
    reconnect: () => {},
    refreshQueue: () => {},
  },
} satisfies Meta<typeof SessionChatNotices>;
export default meta;
type Story = StoryObj<typeof SessionChatNotices>;
export const HistoryLoadError: Story = {
  args: { error: "Could not load the conversation." },
};
export const QueueLoadError: Story = {
  args: { queueError: "Could not load queued prompts." },
};
