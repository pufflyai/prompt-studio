import type { SessionMessage } from "../components/message-types";
import { buildLargeChatConversation } from "./chat-performance-fixtures";

const rich = buildLargeChatConversation({ sessionId: "rendering", turns: 500, textRepeat: 4, toolCallsPerTurn: 3 });
const response = buildLargeChatConversation({
  sessionId: "long-turn",
  turns: 1,
  textRepeat: 1,
  toolCallsPerTurn: 3,
})[1];
const responses = Array.from({ length: 5_000 }, (_, index) => ({ ...response, id: `response-${index}` }));

export const chatRenderingFixtures: Record<string, SessionMessage[]> = {
  "Rich turns": rich,
  "Plain turns": rich.map((message) => ({
    ...message,
    parts: [{ type: "text", text: message.role === "user" ? "Inspect the rendering." : "The response is ready." }],
  })),
  "1000 responses": [rich[0], ...responses.slice(0, 1_000)],
  "5000 responses": [rich[0], ...responses],
  "Large response": [
    rich[0],
    {
      ...response,
      id: "large-response",
      parts: [
        {
          type: "text",
          text: Array.from({ length: 100 }, () => response.parts.find((part) => part.type === "text")?.text).join(
            "\n\n",
          ),
        },
      ],
    },
  ],
};

export const renderingStreamTail = [{ ...response, id: "streamed-response" }];
