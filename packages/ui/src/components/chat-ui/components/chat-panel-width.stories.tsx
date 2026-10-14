import { Box, Button } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, waitFor, within } from "storybook/test";
import { ChatPanel } from "./chat-panel";
import type { SessionMessage } from "./message-types";
import { ChatWorkspaceHub } from "./workspace-hub";

const messages: SessionMessage[] = [
  { id: "prompt", role: "user", parts: [{ type: "text", text: "Review the release checks." }] },
  {
    id: "response",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: Array.from(
          { length: 24 },
          (_, index) => `Check ${index + 1}: Review service health, errors, timing, and remaining work.`,
        ).join("\n\n"),
      },
    ],
  },
];

const meta: Meta<typeof ChatPanel> = {
  title: "Patterns/Chat/Chat Panel Width",
  component: ChatPanel,
  tags: ["chat-width"],
  parameters: { layout: "fullscreen" },
  args: {
    messages,
    emptyStateTitle: "No messages yet",
    emptyStateDescription: "Send a message to start this session.",
    chatInputPlaceholder: "Type a message...",
    workspaceHub: (
      <ChatWorkspaceHub
        workspaceControl={
          <Button size="xs" variant="ghost">
            Release checks
          </Button>
        }
        additions={0}
        deletions={0}
      />
    ),
    queuedFollowUps: [{ id: "queued", prompt: "Prepare the release notes.", position: 1 }],
  },
};

export default meta;
type Story = StoryObj<typeof ChatPanel>;

const checkContentWidth: NonNullable<Story["play"]> = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const log = await canvas.findByRole("log");
  const viewport = log.querySelector<HTMLElement>('[data-part="viewport"]')!;
  const content = viewport.querySelector<HTMLElement>('[data-part="content"]')!;
  const composer = log.nextElementSibling as HTMLElement;
  const scrollbar = viewport.parentElement!.querySelector<HTMLElement>(
    ':scope > [data-part="scrollbar"][data-orientation="vertical"]',
  )!;

  await waitFor(() => {
    expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    expect(getComputedStyle(viewport).visibility).toBe("visible");
    expect(scrollbar).toBeVisible();
  });
  const pane = log.parentElement!.getBoundingClientRect();
  const transcript = content.getBoundingClientRect();
  const footer = composer.getBoundingClientRect();
  const expectedWidth = Math.min(pane.width, 832);

  expect(viewport.getBoundingClientRect().width).toBeCloseTo(pane.width, 0);
  expect(transcript.width).toBeCloseTo(expectedWidth, 0);
  expect(transcript.left + transcript.width / 2).toBeCloseTo(pane.left + pane.width / 2, 0);
  expect(footer.width).toBeCloseTo(transcript.width, 0);
  expect(footer.left).toBeCloseTo(transcript.left, 0);

  expect(scrollbar.getBoundingClientRect().right).toBeGreaterThan(pane.right - 12);
  expect(viewport.scrollWidth).toBe(viewport.clientWidth);
};

export const WidePane: Story = {
  render: (args) => (
    <Box w="1200px" maxW="full" h="680px" bg="bg">
      <ChatPanel {...args} />
    </Box>
  ),
  play: checkContentWidth,
};

export const NarrowPane: Story = {
  render: (args) => (
    <Box w="420px" maxW="full" h="680px" bg="bg">
      <ChatPanel {...args} />
    </Box>
  ),
  play: checkContentWidth,
};

export const EmptyWidePane: Story = {
  ...WidePane,
  args: { messages: [], queuedFollowUps: [] },
  play: undefined,
};
