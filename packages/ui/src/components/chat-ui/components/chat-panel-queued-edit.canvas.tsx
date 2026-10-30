import { Box, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";
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
const meta = { title: "Patterns/Chat/Queued follow-up edit", component: QueuedEditHost } satisfies CanvasMeta<
  typeof QueuedEditHost
>;
export default meta;
export const EditingSurface: CanvasVariant<typeof meta> = {
  id: "patterns-chat-queued-follow-up-edit--editing-surface",
};
export const KeepDraftAfterQueuedEdit: CanvasVariant<typeof meta> = {
  id: "patterns-chat-queued-follow-up-edit--keep-draft-after-queued-edit",
};
export const KeepMatchingDraftAfterQueuedEdit: CanvasVariant<typeof meta> = {
  id: "patterns-chat-queued-follow-up-edit--keep-matching-draft-after-queued-edit",
};
