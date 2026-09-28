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
export const TemporaryHistoryError: Story = {
  args: { error: { message: "The server had a temporary problem.", temporary: true } },
};
export const PermanentHistoryError: Story = {
  args: { error: { message: "This session no longer exists.", temporary: false } },
};
export const TemporaryQueueError: Story = {
  args: { queueError: { message: "The server had a temporary problem.", temporary: true } },
};
