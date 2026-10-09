import { Box, Button, HStack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ChatPanel } from "./chat-panel";
import type { QueuedFollowUp } from "./message-types";

interface QueueHostProps {
  count?: number;
  fail?: boolean;
  unsupported?: boolean;
}
const QueueHost = (props: QueueHostProps) => {
  const { count = 2, fail = false, unsupported = false } = props;
  const [items, setItems] = useState<QueuedFollowUp[]>(
    Array.from({ length: count }, (_, index) => ({
      id: `item-${index}`,
      position: index + 1,
      revision: `saved-${index}`,
      prompt: `Queued message ${index + 1}`,
      model: "Codex",
      params: { thinking: "high" },
      attachments: index === 1 ? [{ id: "attachment", name: "notes.txt", mediaType: "text/plain" }] : [],
    })),
  );
  const [draft, setDraft] = useState("Unsent draft");
  const [selected, setSelected] = useState<QueuedFollowUp | null>(null);
  const [settings, setSettings] = useState<
    Record<
      string,
      {
        model: string;
        params: Record<string, string | boolean>;
        attachments: NonNullable<QueuedFollowUp["attachments"]>;
      }
    >
  >({});
  const [result, setResult] = useState("");
  const current = selected
    ? (settings[selected.id] ?? {
        model: selected.model ?? "Codex",
        params: selected.params ?? {},
        attachments: selected.attachments ?? [],
      })
    : undefined;
  const change = (patch: Partial<NonNullable<typeof current>>) => {
    if (selected && current) setSettings((state) => ({ ...state, [selected.id]: { ...current, ...patch } }));
  };
  return (
    <Box h="32rem" w="full" maxW="40rem" display="flex" flexDirection="column">
      <ChatPanel
        messages={[]}
        streaming
        chatInputDefaultValue={draft}
        onChatInputChange={setDraft}
        queuedFollowUps={items}
        onQueuedFollowUpSelect={setSelected}
        onQueuedFollowUpDiscard={(id) =>
          setSettings((state) => {
            const next = { ...state };
            delete next[id];
            return next;
          })
        }
        unsavedQueueItemIds={Object.keys(settings)}
        queueSteeringUnavailableReason={unsupported ? "This harness cannot accept live input." : null}
        actions={
          current ? (
            <HStack>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => change({ model: current.model === "Codex" ? "Claude" : "Codex" })}
              >
                {current.model}
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => change({ params: { thinking: current.params.thinking === "high" ? "low" : "high" } })}
              >
                {String(current.params.thinking)}
              </Button>
            </HStack>
          ) : undefined
        }
        attachmentActions={
          current ? (
            <Button
              size="xs"
              variant="ghost"
              onClick={() => change({ attachments: [...current.attachments, { id: "new", name: "context.txt" }] })}
            >
              Attach context
            </Button>
          ) : undefined
        }
        attachmentList={
          current?.attachments.length ? (
            <HStack>
              {current.attachments.map((file) => (
                <Button
                  key={file.id}
                  size="xs"
                  variant="ghost"
                  onClick={() =>
                    change({ attachments: current.attachments.filter((attachment) => attachment.id !== file.id) })
                  }
                >
                  {file.name}
                </Button>
              ))}
            </HStack>
          ) : undefined
        }
        onQueuedFollowUpUpdate={async (id, prompt) => {
          if (fail) throw new Error("Could not save. Your edit is kept.");
          setItems((state) =>
            state.map((item) =>
              item.id === id ? { ...item, ...settings[id], prompt, revision: crypto.randomUUID() } : item,
            ),
          );
          setSettings((state) => {
            const next = { ...state };
            delete next[id];
            return next;
          });
        }}
        onQueuedFollowUpRemove={(id) => setItems((state) => state.filter((item) => item.id !== id))}
        onQueuedFollowUpMove={(id, direction, steps = 1) =>
          setItems((state) => {
            const next = [...state];
            const from = next.findIndex((item) => item.id === id);
            const [item] = next.splice(from, 1);
            next.splice(from + (direction === "up" ? -steps : steps), 0, item);
            return next;
          })
        }
        onQueuedFollowUpCombine={(source, target) =>
          setItems((state) => {
            const ordered = state.filter((item) => item.id === source.id || item.id === target.id);
            return state
              .filter((item) => item.id !== source.id)
              .map((item) =>
                item.id === target.id
                  ? {
                      ...item,
                      prompt: ordered.map((item) => item.prompt).join("\n\n"),
                      attachments: [
                        ...new Map(
                          [...(target.attachments ?? []), ...(source.attachments ?? [])].map((file) => [file.id, file]),
                        ).values(),
                      ],
                      revision: crypto.randomUUID(),
                    }
                  : item,
              );
          })
        }
        onQueuedFollowUpSteer={async (item) => {
          setItems((state) => state.filter((saved) => saved.id !== item.id));
          setResult(`Accepted: ${item.prompt}`);
        }}
      />
      <Text textStyle="label/XS">{result}</Text>
    </Box>
  );
};
const meta = { title: "Patterns/Chat/Queued conversation", component: QueueHost } satisfies Meta<typeof QueueHost>;
export default meta;
type Story = StoryObj<typeof meta>;
export const InlineEditor: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "Edit queued message: Queued message 2" }));
    await expect(c.getByRole("button", { name: "Update", exact: true })).toBeVisible();
    await expect(c.getByRole("textbox")).toHaveTextContent("Queued message 2");
    await expect(c.getByRole("button", { name: "Edit saved draft" })).toHaveTextContent("Unsent draft");
  },
};
export const SwitchingTargets: Story = {
  tags: ["!manifest"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "Edit queued message: Queued message 2" }));
    await userEvent.click(c.getByRole("textbox"));
    await userEvent.keyboard(" amended");
    await userEvent.click(c.getByRole("button", { name: "Codex", exact: true }));
    await userEvent.click(c.getByRole("button", { name: "Attach context" }));
    await userEvent.click(c.getByRole("button", { name: "Edit queued message: Queued message 1" }));
    await userEvent.click(c.getByRole("button", { name: "Edit saved draft" }));
    await expect(c.getByRole("textbox")).toHaveTextContent("Unsent draft");
    await userEvent.click(c.getByRole("button", { name: "Edit queued message: Queued message 2" }));
    await expect(c.getByRole("textbox")).toHaveTextContent("amended");
    await expect(c.getByRole("button", { name: "Claude", exact: true })).toBeVisible();
    await expect(c.getByRole("button", { name: "context.txt", exact: true })).toBeVisible();
  },
};
export const FailedUpdate: Story = {
  args: { fail: true },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "Edit queued message: Queued message 2" }));
    await userEvent.click(c.getByRole("textbox"));
    await userEvent.keyboard(" kept");
    await userEvent.click(c.getByRole("button", { name: "Update", exact: true }));
    await expect(c.getByRole("alert")).toHaveTextContent("Your edit is kept");
    await expect(c.getByRole("textbox")).toHaveTextContent("kept");
  },
};
export const SavedUpdate: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "Edit queued message: Queued message 2" }));
    await userEvent.click(c.getByRole("textbox"));
    await userEvent.keyboard(" saved");
    await userEvent.click(c.getByRole("button", { name: "Update", exact: true }));
    await expect(c.getByRole("textbox")).toHaveTextContent("Unsent draft");
    await userEvent.click(c.getByRole("button", { name: "Edit queued message: Queued message 2 saved" }));
    await expect(c.getByRole("textbox")).toHaveTextContent("Queued message 2 saved");
  },
};
export const Overflow: Story = { args: { count: 20 } };
export const Unsupported: Story = {
  args: { unsupported: true },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "Drag queued follow-up 1" }));
    await userEvent.keyboard(" ");
    await userEvent.keyboard("{Home}");
    await userEvent.keyboard(" ");
    await waitFor(() => expect(c.getByRole("alert")).toHaveTextContent("This harness cannot accept live input."));
    await expect(c.getByRole("button", { name: "Edit queued message: Queued message 1" })).toBeVisible();
  },
};
export const EscapeCancelsDragBeforeEdit: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "Edit queued message: Queued message 2" }));
    await userEvent.click(c.getByRole("textbox"));
    await userEvent.keyboard(" keep this edit");
    await userEvent.click(c.getByRole("button", { name: "Drag queued follow-up 2" }));
    await userEvent.keyboard(" ");
    await waitFor(() => expect(canvasElement.querySelector("[data-queue-send-now]")).toBeInTheDocument());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(canvasElement.querySelector("[data-queue-send-now]")).not.toBeInTheDocument());
    await expect(c.getByRole("button", { name: "Update", exact: true })).toBeVisible();
    await expect(c.getByRole("textbox")).toHaveTextContent("keep this edit");
    await userEvent.click(c.getByRole("textbox"));
    await userEvent.keyboard("{Escape}");
    await expect(c.getByRole("textbox")).toHaveTextContent("Unsent draft");
  },
};
export const EscapeCancelsEdit: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "Edit queued message: Queued message 2" }));
    await userEvent.click(c.getByRole("button", { name: "Codex", exact: true }));
    await userEvent.click(c.getByRole("button", { name: "high", exact: true }));
    await userEvent.click(c.getByRole("button", { name: "Attach context" }));
    await userEvent.click(c.getByRole("textbox"));
    await userEvent.keyboard(" discarded{Escape}");
    await waitFor(() => expect(c.queryByRole("button", { name: "Update", exact: true })).not.toBeInTheDocument());
    await expect(c.getByRole("textbox")).toHaveTextContent("Unsent draft");
    await userEvent.click(c.getByRole("button", { name: "Edit queued message: Queued message 2" }));
    await expect(c.getByRole("textbox")).toHaveTextContent("Queued message 2");
    await expect(c.getByRole("textbox")).not.toHaveTextContent("discarded");
    await expect(c.getByRole("button", { name: "Codex", exact: true })).toBeVisible();
    await expect(c.getByRole("button", { name: "high", exact: true })).toBeVisible();
    await expect(c.queryByRole("button", { name: "context.txt", exact: true })).not.toBeInTheDocument();
    await expect(c.getByRole("button", { name: "notes.txt", exact: true })).toBeVisible();
  },
};
