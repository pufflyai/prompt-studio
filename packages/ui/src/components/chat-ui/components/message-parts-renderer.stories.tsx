import { Box, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import rawConversationMessages from "../mocks/full-conversation-normalized.json";
import { ChatMessage } from "./ai-message";
import { MessagePartsRenderer } from "./message-parts-renderer";
import type { SessionMessage } from "./message-types";
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

const assistantMessageWithHiddenTokenUsage: SessionMessage = {
  id: "assistant-token-usage",
  role: "assistant",
  parts: [
    { type: "text", text: "Request completed without exposing provider token metadata." },
    { type: "token_usage", inputTokens: 12_840, outputTokens: 912, cacheReadTokens: 6_400 },
  ],
};

const meta: Meta<typeof MessagePartsRenderer> = {
  title: "Patterns/Chat/Message Parts Renderer",
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

export const HiddenTokenUsageParts: Story = {
  render: () => <MessagePreview message={assistantMessageWithHiddenTokenUsage} />,
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
