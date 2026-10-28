import { Box, Button, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { ChatPanel } from "./chat-panel";
import type { SessionMessage } from "./message-types";

const wrappedPrompt =
  "Please review the release checklist and explain each remaining risk. Include the current status, the responsible owner, the next action, and the validation evidence for every item. Keep the summary useful for someone who has not read the source code.";
const messages = (text: string): SessionMessage[] => [
  { id: "prompt", role: "user", parts: [{ type: "text", text }] },
  { id: "answer", role: "assistant", parts: [{ type: "text", text: "I will review the remaining risks." }] },
];

interface PreviewProps {
  text: string;
  narrow?: boolean;
  resizable?: boolean;
}
function Preview(props: PreviewProps) {
  const { text, narrow = false, resizable = false } = props;
  const [isNarrow, setNarrow] = useState(narrow);
  return (
    <Stack>
      {resizable ? <Button onClick={() => setNarrow(!isNarrow)}>Resize panel</Button> : null}
      <Box width={isNarrow ? "280px" : "960px"} maxWidth="full" height="520px" bg="bg" overflow="hidden">
        <ChatPanel
          messages={messages(text)}
          emptyStateTitle="No messages"
          emptyStateDescription="Send a message"
          chatInputPlaceholder="Type a message..."
        />
      </Box>
    </Stack>
  );
}

const meta: Meta = {
  title: "Patterns/Chat/Collapsed User Message",
  parameters: { layout: "padded" },
  tags: ["!manifest"],
};
export default meta;
type Story = StoryObj;

export const WrappedPrompt: Story = {
  render: () => <Preview text={wrappedPrompt} narrow />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const more = await canvas.findByRole("button", { name: "Show more" });
    await expect(more).toBeVisible();
    const bubble = more.closest(".ai-message__content")!;
    await expect(bubble.getBoundingClientRect().height).toBe(128);
    await expect(getComputedStyle(bubble).borderTopWidth).toBe("0px");
    const footer = bubble.lastElementChild!;
    const footerStyle = getComputedStyle(footer);
    await expect(footerStyle.backgroundColor).toBe(getComputedStyle(bubble).backgroundColor);
    await expect(footerStyle.paddingTop).toBe("0px");
    const viewport = bubble.querySelector<HTMLElement>("[data-sticky-user-message-content]")!;
    const body = viewport.querySelector('[data-part="content"]')!.firstElementChild!;
    await expect(getComputedStyle(body).paddingBottom).toBe("0px");
    await expect(viewport.getBoundingClientRect().bottom).toBeLessThanOrEqual(footer.getBoundingClientRect().top);
    await expect(getComputedStyle(footer, "::before").height).toBe("48px");
    await expect(getComputedStyle(footer, "::before").backgroundImage).toContain("75%");
    await expect(getComputedStyle(footer, "::before").backgroundImage).toContain(
      getComputedStyle(bubble).backgroundColor,
    );
    await userEvent.click(more);
    const less = await canvas.findByRole("button", { name: "Show less" });
    await expect(less).toBeVisible();
    await expect(viewport.dataset.scope).toBe("scroll-area");
    await expect(viewport.dataset.part).toBe("viewport");
    await expect(viewport.getBoundingClientRect().bottom).toBeLessThanOrEqual(footer.getBoundingClientRect().top);

    await userEvent.click(less);
    await expect(more).toBeVisible();
  },
};

export const MarkdownHeadings: Story = {
  render: () => <Preview text={"# Release status\n# Remaining risks\n# Next actions"} />,
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole("button", { name: "Show more" })).toBeVisible();
  },
};

export const ResizeWrappedPrompt: Story = {
  render: () => <Preview text={wrappedPrompt} resizable />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Resize panel" }));
    const more = await canvas.findByRole("button", { name: "Show more" });
    await userEvent.click(more);
    await expect(canvas.getByRole("button", { name: "Show less" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Resize panel" }));
    await expect(canvas.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Show less" })).not.toBeInTheDocument();
  },
};

export const ShortPrompt: Story = {
  render: () => <Preview text="Review the release checklist." narrow />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
  },
};

function UpdatedPrompt() {
  const [text, setText] = useState("Review the release checklist.");
  return (
    <Stack>
      <Button onClick={() => setText(wrappedPrompt)}>Load full prompt</Button>
      <Preview text={text} narrow />
    </Stack>
  );
}

export const UpdatedContent: Story = {
  render: () => <UpdatedPrompt />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Load full prompt" }));
    await expect(await canvas.findByRole("button", { name: "Show more" })).toBeVisible();
  },
};

export const ThemePreview: Story = {
  render: () => <Preview text={wrappedPrompt} narrow />,
};
