import { Box, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ChatPanel } from "./chat-panel";
import type { QueuedFollowUp } from "./message-types";

// The host owns the live draft, as the dashboard does, and passes it back as the composer value.
const QueuedEditHost = () => {
  const [draft, setDraft] = useState("");
  const [queued, setQueued] = useState<QueuedFollowUp[]>([
    { id: "queued-1", prompt: "Run the validation suite next.", position: 1 },
  ]);
  return (
    <Box h="32rem" w="full" maxW="40rem" display="flex" flexDirection="column">
      <Box flex="1" minH="0">
        <ChatPanel
          messages={[]}
          streaming
          emptyStateTitle="Agent is working"
          emptyStateDescription="New messages wait in the queue."
          chatInputPlaceholder="Reply to the agent..."
          chatInputDefaultValue={draft}
          onChatInputChange={setDraft}
          queuedFollowUps={queued}
          onQueuedFollowUpUpdate={(itemId, prompt) =>
            setQueued((items) => items.map((item) => (item.id === itemId ? { ...item, prompt } : item)))
          }
          onQueuedFollowUpRemove={(itemId) => setQueued((items) => items.filter((item) => item.id !== itemId))}
        />
      </Box>
      <Text textStyle="label/S/regular" color="fg.subtle">
        Stored draft: {draft || "(empty)"}
      </Text>
    </Box>
  );
};

const meta = { title: "Patterns/Chat/Queued follow-up edit", component: QueuedEditHost } satisfies Meta<
  typeof QueuedEditHost
>;
export default meta;

export const KeepDraftAfterQueuedEdit: StoryObj<typeof meta> = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editor = () => canvas.getAllByTestId("content-editable").at(-1)!;
    await userEvent.click(editor());
    await userEvent.keyboard("Half-written note");
    await waitFor(() => expect(canvas.getByText("Stored draft: Half-written note")).toBeVisible());
    await userEvent.click(canvas.getByRole("button", { name: "Edit queued follow-up" }));
    await waitFor(() => expect(editor()).toHaveTextContent("Run the validation suite next."));
    await userEvent.click(editor());
    await userEvent.keyboard(" Then summarize.{Enter}");
    await waitFor(() => expect(canvas.getByText("Run the validation suite next. Then summarize.")).toBeVisible());
    await waitFor(() => expect(editor()).toHaveTextContent("Half-written note"));
    await expect(canvas.getByText("Stored draft: Half-written note")).toBeVisible();
  },
};
