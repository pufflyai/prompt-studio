import type { Meta, StoryObj } from "@storybook/react";
import type { SessionMessage } from "../agent-types";
import rawConversationMessages from "../mocks/full-conversation-normalized.json";
import { Response } from "./ai-response";

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

const meta: Meta<typeof Response> = {
  title: "Patterns/Chat/AI Response",
  component: Response,
  parameters: {
    layout: "padded",
  },
};

export default meta;

type Story = StoryObj<typeof Response>;

export const AssistantResponse: Story = {
  args: {
    children: assistantResponseForStory,
    height: "auto",
  },
};

export const UserPromptAsContent: Story = {
  args: {
    children: userPromptForStory,
    height: "auto",
  },
};
