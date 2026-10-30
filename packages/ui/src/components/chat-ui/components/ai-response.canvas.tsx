import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import rawConversationMessages from "../mocks/full-conversation-normalized.json";
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
const meta: CanvasMeta<typeof Response> = {
  title: "Patterns/Chat/AI Response",
  component: Response,
  parameters: {
    layout: "padded",
  },
};
export default meta;
type Story = CanvasVariant<typeof Response>;
export const AssistantResponse: Story = {
  id: "patterns-chat-ai-response--assistant-response",
  args: {
    children: assistantResponseForStory,
    height: "auto",
  },
};
export const UserPromptAsContent: Story = {
  id: "patterns-chat-ai-response--user-prompt-as-content",
  args: {
    children: userPromptForStory,
    height: "auto",
  },
};
