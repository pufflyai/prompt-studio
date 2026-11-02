import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { ChatPanel } from "./chat-panel";

const meta = {
  title: "Patterns/Chat/Queued submission",
  component: ChatPanel,
  decorators: [
    (Story) => (
      <Box h="full" minH="32rem" maxW="40rem">
        <Story />
      </Box>
    ),
  ],
  args: {
    messages: [],
    streaming: true,
    queuedFollowUps: [
      { id: "saved", position: 1, revision: "saved", prompt: "Review the current changes" },
      {
        id: "sending",
        prompt: "Add a browser check",
        sending: true,
        attachments: [{ id: "notes", name: "notes.txt" }],
      },
    ],
    onQueuedFollowUpUpdate: () => {},
    onQueuedFollowUpRemove: () => {},
    onQueuedFollowUpMove: () => {},
  },
} satisfies CanvasMeta<typeof ChatPanel>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const Sending: Story = {
  id: "patterns-chat-queued-submission--sending",
};
export const LiveInput: Story = {
  id: "patterns-chat-queued-submission--live-input",
  args: {
    messages: [
      { id: "working", role: "assistant", parts: [{ type: "text", text: "Reviewing the changes." }] },
      { id: "delivery", role: "user", parts: [{ type: "text", text: "Check the keyboard interaction too." }] },
    ],
    queuedFollowUps: [{ id: "saved", position: 1, revision: "saved", prompt: "Write the release notes" }],
  },
};
