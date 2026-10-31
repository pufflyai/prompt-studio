import { Box, Button } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { ChatPanel } from "./chat-panel";
import type { QueuedFollowUp } from "./message-types";

interface RecoveryHostProps {
  draft?: string;
  remaining?: boolean;
  remainingCount?: number;
  draftHasFiles?: boolean;
  draftWritable?: boolean;
  fail?: boolean;
}
const RecoveryHost = (props: RecoveryHostProps) => {
  const {
    draft: initialDraft = "",
    remaining = false,
    remainingCount = 1,
    draftHasFiles = false,
    draftWritable = true,
    fail = false,
  } = props;
  const [draft, setDraft] = useState(initialDraft);
  const [items, setItems] = useState<QueuedFollowUp[]>([
    { id: "selected", position: 1, prompt: "Queued request", revision: "saved" },
    ...(remaining
      ? Array.from({ length: remainingCount }, (_, index) => ({
          id: `other-${index}`,
          position: index + 2,
          prompt: index ? "Third request" : "Other request",
          revision: `other-${index}`,
        }))
      : []),
  ]);
  return (
    <Box h="32rem" maxW="40rem">
      <Button size="xs" onClick={() => setItems((current) => current.filter((item) => item.id !== "selected"))}>
        Send selected request
      </Button>
      <Button
        size="xs"
        onClick={() => setItems((current) => current.map((item) => ({ ...item, revision: "changed" })))}
      >
        Change saved revision
      </Button>
      <ChatPanel
        chatInputPlaceholder="Write a prompt"
        emptyStateDescription="Send a prompt"
        emptyStateTitle="Start a conversation"
        messages={[]}
        chatInputDefaultValue={draft}
        onChatInputChange={draftWritable ? setDraft : undefined}
        queuedFollowUps={items}
        canRestoreQueuedEditToDraft={!draftHasFiles}
        onQueuedFollowUpUpdate={() => {}}
        onQueuedFollowUpMove={(id, direction, steps = 1, selection) => {
          if (selection?.items.some((item) => !items.some((saved) => saved.id === item.id)))
            throw new Error("Queue membership changed.");
          setItems((current) => {
            const next = [...current];
            const from = next.findIndex((item) => item.id === id);
            const [item] = next.splice(from, 1);
            next.splice(from + (direction === "up" ? -steps : steps), 0, item);
            return next;
          });
        }}
        onQueuedFollowUpCreate={async (_id, prompt) => {
          if (fail) throw new Error("Could not create. Your edit is kept.");
          setItems((current) => [...current, { id: "created", prompt, revision: "created" }]);
        }}
      />
    </Box>
  );
};
const meta = { title: "Patterns/Chat/Queued edit recovery", component: RecoveryHost } satisfies CanvasMeta<
  typeof RecoveryHost
>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const EmptyDraft: Story = {
  id: "patterns-chat-queued-edit-recovery--empty-draft",
};
export const OccupiedDraft: Story = {
  id: "patterns-chat-queued-edit-recovery--occupied-draft",
  args: { draft: "Independent draft" },
};
export const RemainingQueue: Story = {
  id: "patterns-chat-queued-edit-recovery--remaining-queue",
  args: { remaining: true },
};
export const DraftWithAttachments: Story = {
  id: "patterns-chat-queued-edit-recovery--draft-with-attachments",
  args: { draftHasFiles: true },
};
export const FailedCreate: Story = {
  id: "patterns-chat-queued-edit-recovery--failed-create",
  args: { draft: "Independent draft", fail: true },
};
export const ChangedRevision: Story = {
  id: "patterns-chat-queued-edit-recovery--changed-revision",
};
export const NoDraftWriter: Story = {
  id: "patterns-chat-queued-edit-recovery--no-draft-writer",
  args: { draftWritable: false },
};
export const ReorderAfterSending: Story = {
  id: "patterns-chat-queued-edit-recovery--reorder-after-sending",
  args: { remaining: true, remainingCount: 2 },
};
