import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";
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
    onQueuedFollowUpUpdate: fn(),
    onQueuedFollowUpRemove: fn(),
    onQueuedFollowUpMove: fn(),
  },
} satisfies Meta<typeof ChatPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sending: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Edit queued message: Review the current changes" })).toBeEnabled();
    await expect(canvas.getByRole("button", { name: "Edit queued message: Add a browser check" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Drag queued follow-up 2" })).toBeDisabled();
    await expect(canvas.getAllByRole("button", { name: "Remove queued follow-up" })).toHaveLength(1);
  },
};
