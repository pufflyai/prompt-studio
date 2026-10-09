import { Box, Button } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
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
const meta = { title: "Patterns/Chat/Queued edit recovery", component: RecoveryHost } satisfies Meta<
  typeof RecoveryHost
>;
export default meta;
type Story = StoryObj<typeof meta>;
const editAndSend = async (canvasElement: HTMLElement) => {
  const c = within(canvasElement);
  await userEvent.click(c.getByRole("button", { name: "Edit queued message: Queued request" }));
  await userEvent.click(c.getByRole("textbox"));
  await userEvent.keyboard(" amended");
  const cancel = c.getByRole("button", { name: "Cancel", exact: true });
  await expect(cancel.nextElementSibling).toBe(c.getByRole("button", { name: "Update", exact: true }));
  await userEvent.click(c.getByRole("button", { name: "Send selected request" }));
  return c;
};
export const EmptyDraft: Story = {
  play: async ({ canvasElement }) => {
    const c = await editAndSend(canvasElement);
    await expect(c.queryByRole("button", { name: "Update", exact: true })).not.toBeInTheDocument();
    await expect(c.queryByRole("button", { name: "Edit saved draft" })).not.toBeInTheDocument();
    await expect(c.getByRole("textbox")).toHaveTextContent("Queued request amended");
    await expect(c.getByRole("status", { name: "Queued edit notice" })).toHaveTextContent("moved to the draft");
    await userEvent.click(c.getByRole("textbox"));
    await userEvent.keyboard(" changed");
    await expect(c.queryByRole("status", { name: "Queued edit notice" })).not.toBeInTheDocument();
  },
};
export const OccupiedDraft: Story = {
  args: { draft: "Independent draft" },
  play: async ({ canvasElement }) => {
    const c = await editAndSend(canvasElement);
    const create = c.getByRole("button", { name: "Create new queue item", exact: true });
    await expect(create).toBeEnabled();
    await expect(c.getByRole("status", { name: "Queued edit notice" })).toHaveTextContent("sent");
    await expect(c.getByRole("button", { name: "Edit saved draft" })).toHaveTextContent("Independent draft");
    await userEvent.click(create);
    await expect(c.getByRole("textbox")).toHaveTextContent("Independent draft");
    await expect(c.getByRole("button", { name: "Edit queued message: Queued request amended" })).toBeVisible();
  },
};
export const RemainingQueue: Story = {
  args: { remaining: true },
  play: async ({ canvasElement }) => {
    const c = await editAndSend(canvasElement);
    await expect(c.getByRole("button", { name: "Create new queue item", exact: true })).toBeEnabled();
    await expect(c.getByRole("button", { name: "Edit queued message: Other request" })).toBeVisible();
  },
};
export const DraftWithAttachments: Story = {
  args: { draftHasFiles: true },
  play: async ({ canvasElement }) => {
    const c = await editAndSend(canvasElement);
    await expect(c.getByRole("button", { name: "Create new queue item", exact: true })).toBeEnabled();
    await expect(c.getByRole("button", { name: "Edit saved draft" })).toBeVisible();
  },
};
export const FailedCreate: Story = {
  args: { draft: "Independent draft", fail: true },
  play: async ({ canvasElement }) => {
    const c = await editAndSend(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "Create new queue item", exact: true }));
    await expect(c.getByRole("alert")).toHaveTextContent("Your edit is kept");
    await expect(c.getByRole("textbox")).toHaveTextContent("amended");
    await userEvent.click(c.getByRole("button", { name: "Cancel", exact: true }));
    await expect(c.getByRole("textbox")).toHaveTextContent("Independent draft");
  },
};
export const ChangedRevision: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "Edit queued message: Queued request" }));
    await userEvent.click(c.getByRole("textbox"));
    await userEvent.keyboard(" kept");
    await userEvent.click(c.getByRole("button", { name: "Change saved revision" }));
    await expect(c.getByRole("button", { name: "Update", exact: true })).toBeDisabled();
    await expect(c.getByRole("alert")).toHaveTextContent("request changed");
    await expect(c.queryByRole("button", { name: "Create new queue item", exact: true })).not.toBeInTheDocument();
    await expect(c.getByRole("textbox")).toHaveTextContent("kept");
  },
};
export const NoDraftWriter: Story = {
  args: { draftWritable: false },
  play: async ({ canvasElement }) => {
    const c = await editAndSend(canvasElement);
    await expect(c.getByRole("textbox")).toHaveTextContent("Queued request amended");
    await expect(c.getByRole("button", { name: "Create new queue item", exact: true })).toBeEnabled();
  },
};
export const ReorderAfterSending: Story = {
  args: { remaining: true, remainingCount: 2 },
  play: async ({ canvasElement }) => {
    const c = await editAndSend(canvasElement);
    await expect(c.queryByRole("button", { name: "Drag queued follow-up 3" })).not.toBeInTheDocument();
    await userEvent.click(c.getByRole("button", { name: "Drag queued follow-up 1" }));
    await userEvent.keyboard(" ");
    await userEvent.keyboard("{End} ");
    await waitFor(() =>
      expect(canvasElement.querySelector("[data-queued-follow-up-id]:last-child")).toHaveTextContent("Other request"),
    );
    await expect(c.queryByRole("alert")).not.toBeInTheDocument();
    await expect(c.getByRole("button", { name: "Create new queue item", exact: true })).toBeEnabled();
  },
};
