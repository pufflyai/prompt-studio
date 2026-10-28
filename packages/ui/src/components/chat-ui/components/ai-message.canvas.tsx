import { Box, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import rawConversationMessages from "../mocks/full-conversation-normalized.json";
import { ChatMessage } from "./ai-message";
import { Response } from "./ai-response";
import type { SessionMessage } from "./message-types";

const conversationMessages = rawConversationMessages as unknown as SessionMessage[];

const firstPartText = (message: SessionMessage) => {
  return message.parts?.find((part) => part.type === "text" && "text" in part)?.text;
};

const userPromptForStory =
  conversationMessages
    .filter((message) => message.role === "user")
    .map(firstPartText)
    .find(Boolean) ?? "No user message available.";

const assistantResponseForStory =
  conversationMessages
    .filter((message) => message.role === "assistant")
    .map(firstPartText)
    .find((text) => typeof text === "string" && text.length > 0) ?? "No assistant message available.";

const meta: Meta<typeof ChatMessage.Root> = {
  title: "Patterns/Chat/AI Message",
  component: ChatMessage.Root,
  parameters: {
    layout: "padded",
  },
};

export default meta;

type Story = StoryObj<typeof ChatMessage.Root>;

const MessagePreview = () => {
  return (
    <Box maxW="960px" w="full" borderWidth="1px" borderRadius="md" bg="bg" p="md">
      <Stack gap="sm">
        <ChatMessage.Root from="user">
          <ChatMessage.Content from="user">
            <Response height="auto">{userPromptForStory}</Response>
          </ChatMessage.Content>
        </ChatMessage.Root>

        <ChatMessage.Root from="assistant">
          <ChatMessage.Content from="assistant">
            <Response height="auto">{assistantResponseForStory}</Response>
          </ChatMessage.Content>
        </ChatMessage.Root>
      </Stack>
    </Box>
  );
};

export const UserAndAssistant: Story = {
  render: () => <MessagePreview />,
};
