import { Box, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { SessionMessage } from "../agent-types";
import rawConversationMessages from "../mocks/full-conversation-normalized.json";
import { ChatMessage } from "./ai-message";
import { MessagePartsRenderer } from "./message-parts-renderer";
import { getMessageOrigin } from "./message-types";

const conversationMessages = rawConversationMessages as unknown as SessionMessage[];

const hasTextPart = (message: SessionMessage) =>
  (message.parts ?? []).some((part) => part.type === "text" && "text" in part);

const hasReasoningOrToolPart = (message: SessionMessage) =>
  (message.parts ?? []).some((part) => part.type === "reasoning" || part.type === "tool");

const assistantMessageWithRichParts =
  conversationMessages.find((message) => message.role === "assistant" && hasReasoningOrToolPart(message)) ??
  conversationMessages[0];

const userMessageWithText =
  conversationMessages.find((message) => message.role === "user" && hasTextPart(message)) ?? conversationMessages[0];

const assistantMessageWithTokenUsage: SessionMessage = {
  id: "assistant-token-usage",
  role: "assistant",
  parts: [
    { type: "text", text: "Request completed. Here is the token usage for this response." },
    { type: "token_usage", inputTokens: 12_840, outputTokens: 912, cacheReadTokens: 6_400 },
  ],
};

const meta: Meta<typeof MessagePartsRenderer> = {
  title: "Chat UI/Message Parts Renderer",
  component: MessagePartsRenderer,
  parameters: {
    layout: "padded",
  },
};

export default meta;

type Story = StoryObj<typeof MessagePartsRenderer>;

const MessagePreview = (props: { message: SessionMessage }) => {
  const { message } = props;
  const from = getMessageOrigin(message.role);

  return (
    <Box maxW="960px" w="full" borderWidth="1px" borderRadius="md" bg="bg" p="md">
      <Stack gap="sm">
        <ChatMessage.Root from={from}>
          <ChatMessage.Content from={from}>
            <MessagePartsRenderer message={message} />
          </ChatMessage.Content>
        </ChatMessage.Root>
      </Stack>
    </Box>
  );
};

export const AssistantReasoningAndToolParts: Story = {
  render: () => <MessagePreview message={assistantMessageWithRichParts} />,
};

export const UserTextParts: Story = {
  render: () => <MessagePreview message={userMessageWithText} />,
};

export const TokenUsageParts: Story = {
  render: () => <MessagePreview message={assistantMessageWithTokenUsage} />,
};

export const ErrorParts: Story = {
  render: () => (
    <Stack gap="sm">
      <MessagePreview
        message={{
          id: "error-permission",
          role: "system",
          parts: [
            { type: "error", errorType: "permission", message: "Permission denied while reading session output." },
          ],
        }}
      />
      <MessagePreview
        message={{
          id: "error-timeout",
          role: "assistant",
          parts: [{ type: "error", errorType: "timeout", message: "Request timed out after 30s." }],
        }}
      />
      <MessagePreview
        message={{
          id: "error-crash",
          role: "assistant",
          parts: [{ type: "error", errorType: "crash" }],
        }}
      />
      <MessagePreview
        message={{
          id: "error-other",
          role: "assistant",
          parts: [{ type: "error", errorType: "other", message: "Error: Was there a typo in the url or port?" }],
        }}
      />
    </Stack>
  ),
};

export const SingleImageAttachment: Story = {
  render: () => (
    <MessagePreview
      message={{
        id: "single-image",
        role: "user",
        parts: [
          {
            type: "file",
            mediaType: "image/png",
            filename: "screenshot.png",
            url: "https://placehold.co/200x200/png",
          },
        ],
      }}
    />
  ),
};

export const MultipleImageAttachments: Story = {
  render: () => (
    <MessagePreview
      message={{
        id: "multiple-images",
        role: "user",
        parts: [
          {
            type: "file",
            mediaType: "image/jpeg",
            filename: "photo1.jpg",
            url: "https://placehold.co/150x150/FF5733/white?text=Image1",
          },
          {
            type: "file",
            mediaType: "image/jpeg",
            filename: "photo2.jpg",
            url: "https://placehold.co/150x150/33FF57/white?text=Image2",
          },
          {
            type: "file",
            mediaType: "image/gif",
            filename: "animated.gif",
            url: "https://placehold.co/150x150/3357FF/white?text=Image3",
          },
        ],
      }}
    />
  ),
};

export const MixedTextAndImageParts: Story = {
  render: () => (
    <MessagePreview
      message={{
        id: "mixed-text-image",
        role: "user",
        parts: [
          { type: "text", text: "Here are the screenshots I mentioned:" },
          {
            type: "file",
            mediaType: "image/png",
            filename: "error-screen.png",
            url: "https://placehold.co/120x120/FF0000/white?text=Error",
          },
          {
            type: "file",
            mediaType: "image/png",
            filename: "logs.png",
            url: "https://placehold.co/120x120/00FF00/white?text=Logs",
          },
          { type: "text", text: "Let me know if you need more details." },
        ],
      }}
    />
  ),
};

export const ImageWithTextBetween: Story = {
  render: () => (
    <MessagePreview
      message={{
        id: "image-text-interleaved",
        role: "assistant",
        parts: [
          {
            type: "file",
            mediaType: "image/png",
            filename: "preview.png",
            url: "https://placehold.co/100x100/666666/white?text=Preview",
          },
          { type: "text", text: "Here's the updated preview. The changes are highlighted in green." },
          {
            type: "file",
            mediaType: "image/jpeg",
            filename: "diff.jpg",
            url: "https://placehold.co/100x100/666666/white?text=Diff",
          },
        ],
      }}
    />
  ),
};
