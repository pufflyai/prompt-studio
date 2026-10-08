import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, spyOn, userEvent, waitFor, within } from "storybook/test";
import { ChatPanel } from "./chat-panel";
import type { SessionMessage } from "./message-types";

const MeasuredChatStory = () => {
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  return (
    <Box h="96" w="full" maxW="container.sm">
      <ChatPanel
        messages={messages}
        emptyStateTitle="No messages yet"
        emptyStateDescription="Send a message to start this session."
        chatInputPlaceholder="Reply to the agent..."
        onSubmitMessage={(text) => {
          setMessages((current) => [
            ...current,
            { id: `message-${current.length}`, role: "user", parts: [{ type: "text", text }] },
          ]);
        }}
      />
    </Box>
  );
};

const meta: Meta<typeof MeasuredChatStory> = {
  title: "Patterns/Chat/Measurement",
  component: MeasuredChatStory,
};
export default meta;

export const SendMessage: StoryObj<typeof meta> = {
  tags: ["measurement-regression"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const errors = spyOn(console, "error");
    try {
      await userEvent.click(canvas.getByTestId("content-editable"));
      await userEvent.keyboard("Measure this message.");
      await waitFor(() => expect(canvas.getByTestId("send-message-button")).toBeEnabled());
      await userEvent.click(canvas.getByTestId("send-message-button"));
      await waitFor(() => expect(canvas.getByTestId("content-editable")).toBeEmptyDOMElement());
      await waitFor(() => expect(canvas.getByText("Measure this message.")).toBeVisible());
      expect(errors.mock.calls.filter((args) => args.some((arg) => String(arg).includes("flushSync")))).toEqual([]);
    } finally {
      errors.mockRestore();
    }
  },
};
