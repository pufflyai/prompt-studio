import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { SessionChatNotices } from "./session-chat-notices";

const meta = {
  title: "Sessions/Chat notices",
  component: SessionChatNotices,
  args: {
    reconnect: () => {},
    refreshQueue: () => {},
  },
} satisfies CanvasMeta<typeof SessionChatNotices>;
export default meta;
type Story = CanvasFrame<typeof SessionChatNotices>;
export const MessageNotSent: Story = {
  id: "sessions-chat-notices--message-not-sent",
  args: {
    unsent: {
      notice: { message: "The network is unavailable.", temporary: true },
      onRetry: () => {},
      onClose: () => {},
    },
  },
};
export const TemporaryHistoryError: Story = {
  id: "sessions-chat-notices--temporary-history-error",
  args: { error: { message: "The server had a temporary problem.", temporary: true } },
};
export const PermanentHistoryError: Story = {
  id: "sessions-chat-notices--permanent-history-error",
  args: { error: { message: "This session no longer exists.", temporary: false } },
};
export const TemporaryQueueError: Story = {
  id: "sessions-chat-notices--temporary-queue-error",
  args: { queueError: { message: "The server had a temporary problem.", temporary: true } },
};
