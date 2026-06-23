import { Box, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fireEvent, userEvent, within } from "storybook/test";
import rawConversationMessages from "../mocks/full-conversation-normalized.json";
import { ChatPrimitives } from "./ai-conversation";
import { ChatMessage } from "./ai-message";
import { ChatPanel } from "./chat-panel";
import { MessagePartsRenderer } from "./message-parts-renderer";
import type { SessionMessage } from "./message-types";
import { getMessageOrigin, mergeReasoningToolOnlyMessages } from "./message-types";

const conversationMessages = rawConversationMessages as unknown as SessionMessage[];

const meta: Meta<typeof ChatPrimitives.Root> = {
  title: "Patterns/Chat/AI Conversation",
  component: ChatPrimitives.Root,
  parameters: {
    layout: "padded",
  },
};

export default meta;

type Story = StoryObj<typeof ChatPrimitives.Root>;

const storyMessages = mergeReasoningToolOnlyMessages(conversationMessages).slice(-18);

const statusColorPrompt = [
  "```ts",
  "const STATUS_INDICATOR_COLOR_BY_STATUS: Record<string, string> = {",
  '  gray: "gray.400",',
  '  red: "red.400",',
  '  orange: "orange.400",',
  '  yellow: "yellow.400",',
  '  green: "green.400",',
  '  teal: "teal.400",',
  '  blue: "blue.400",',
  '  cyan: "cyan.400",',
  '  purple: "purple.400",',
  '  pink: "pink.400",',
  "};",
  "```",
  "instead of the above, use the correct status colors",
].join("\n");

const multilineUserMessageConversation: SessionMessage[] = [
  {
    id: "status-color-user-message",
    role: "user",
    parts: [{ type: "text", text: statusColorPrompt }],
  },
  {
    id: "status-color-assistant-message",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "I'll update the status indicator colors to use the semantic status tokens.",
      },
    ],
  },
];

const tallStatusColorPrompt = [
  "Please replace this status indicator color map with the correct semantic status colors.",
  "",
  "```ts",
  "const STATUS_INDICATOR_COLOR_BY_STATUS: Record<string, string> = {",
  ...Array.from(
    { length: 72 },
    (_, index) => `  status${String(index + 1).padStart(2, "0")}: getStatusColor(statuses[${index}], theme),`,
  ),
  "};",
  "```",
  "",
  "Keep the result typed, preserve the existing status order, and explain the mapping after the code change.",
].join("\n");

const tallStickyUserMessageConversation: SessionMessage[] = [
  {
    id: "tall-status-color-user-message",
    role: "user",
    parts: [{ type: "text", text: tallStatusColorPrompt }],
  },
  {
    id: "tall-status-color-assistant-message-1",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "I'll replace the raw color palette map with the status color tokens and keep the mapping stable.",
      },
    ],
  },
  {
    id: "tall-status-color-assistant-message-2",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "The important behavior is that the expanded prompt can be reviewed without losing access to the rest of the conversation below it.",
      },
    ],
  },
  {
    id: "tall-status-color-assistant-message-3",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "Once the prompt scroll reaches its boundary, the conversation should continue scrolling so the assistant responses remain reachable.",
      },
    ],
  },
];

const getRequiredStoryElement = (root: HTMLElement, selector: string, label: string) => {
  const element = root.querySelector<HTMLElement>(selector);

  if (!element) {
    throw new Error(`Expected ${label}`);
  }

  return element;
};

const ConversationPreview = () => {
  return (
    <Box h="640px" maxW="960px" w="full" borderWidth="1px" borderRadius="md" bg="bg" overflow="hidden">
      <ChatPrimitives.Root>
        <ChatPrimitives.Viewport>
          <Stack gap="sm">
            {storyMessages.map((message) => (
              <ChatMessage.Root key={message.id} from={getMessageOrigin(message.role)}>
                <ChatMessage.Content from={getMessageOrigin(message.role)}>
                  <MessagePartsRenderer message={message} />
                </ChatMessage.Content>
              </ChatMessage.Root>
            ))}
          </Stack>
        </ChatPrimitives.Viewport>
        <ChatPrimitives.ScrollToBottom aria-label="Scroll to latest message" />
      </ChatPrimitives.Root>
    </Box>
  );
};

export const FullConversationPreview: Story = {
  render: () => <ConversationPreview />,
};

export const MultilineUserMessageShowMore: Story = {
  render: () => (
    <Box h="520px" maxW="960px" w="full" borderWidth="1px" borderRadius="md" bg="bg" overflow="hidden">
      <ChatPanel
        messages={multilineUserMessageConversation}
        emptyStateTitle="No active conversations"
        emptyStateDescription="Start a conversation to see messages here."
        chatInputPlaceholder="Type a message..."
      />
    </Box>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const showMoreButton = await canvas.findByRole("button", { name: "Show more" });
    const userMessageContent = canvasElement.querySelector<HTMLElement>(".ai-message__content");

    if (!userMessageContent) {
      throw new Error("Expected a user message content element");
    }

    await expect(showMoreButton).toBeVisible();
    expect(userMessageContent.getBoundingClientRect().height).toBeLessThanOrEqual(72);
  },
};

export const TallUserMessageScrollHandoff: Story = {
  render: () => (
    <Box h="520px" maxW="960px" w="full" borderWidth="1px" borderRadius="md" bg="bg" overflow="hidden">
      <ChatPanel
        messages={tallStickyUserMessageConversation}
        emptyStateTitle="No active conversations"
        emptyStateDescription="Start a conversation to see messages here."
        chatInputPlaceholder="Type a message..."
      />
    </Box>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const showMoreButton = await canvas.findByRole("button", { name: "Show more" });

    await userEvent.click(showMoreButton);

    const showLessButton = await canvas.findByRole("button", { name: "Show less" });
    const stickyMessageContent = getRequiredStoryElement(
      canvasElement,
      '[data-sticky-user-message-content="expanded"]',
      "an expanded sticky user message content element",
    );
    const conversationViewport = getRequiredStoryElement(
      canvasElement,
      '[data-scope="scroll-area"][data-part="viewport"]',
      "a conversation viewport element",
    );

    await expect(showLessButton).toBeVisible();
    const stickyMessageShell = showLessButton.closest<HTMLElement>(".ai-message__content");

    if (!stickyMessageShell) {
      throw new Error("Expected Show less to render inside the sticky user message");
    }

    expect(stickyMessageShell.contains(stickyMessageContent)).toBe(true);
    expect(stickyMessageShell.contains(showLessButton)).toBe(true);
    expect(stickyMessageContent.scrollHeight).toBeGreaterThan(stickyMessageContent.clientHeight);
    expect(conversationViewport.scrollHeight).toBeGreaterThan(conversationViewport.clientHeight);

    conversationViewport.scrollTop = 0;
    stickyMessageContent.scrollTop = 0;

    const initialConversationScrollTop = conversationViewport.scrollTop;
    fireEvent.wheel(stickyMessageContent, { deltaY: 160 });
    stickyMessageContent.scrollTop = Math.min(
      160,
      stickyMessageContent.scrollHeight - stickyMessageContent.clientHeight,
    );

    expect(stickyMessageContent.scrollTop).toBeGreaterThan(0);
    expect(conversationViewport.scrollTop).toBe(initialConversationScrollTop);
    await expect(showLessButton).toBeVisible();

    stickyMessageContent.scrollTop = stickyMessageContent.scrollHeight;

    const boundaryConversationScrollTop = conversationViewport.scrollTop;
    fireEvent.wheel(stickyMessageContent, { deltaY: 160 });
    conversationViewport.scrollTop = Math.min(
      boundaryConversationScrollTop + 160,
      conversationViewport.scrollHeight - conversationViewport.clientHeight,
    );

    expect(conversationViewport.scrollTop).toBeGreaterThan(boundaryConversationScrollTop);
  },
};
