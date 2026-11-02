import { HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta } from "@pstdio/canvas";
import { GitFork } from "lucide-react";
import { useState } from "react";
import { ChatMessage } from "../../components/chat-ui/components/ai-message";
import { MessageActionPanel } from "../../components/chat-ui/components/message-action-panel";
import type { SessionMessage } from "../../components/chat-ui/components/message-types";
import { Tooltip } from "../../components/primitives/tooltip";

export default { title: "Proposals/PS-56 Message fork" } satisfies CanvasMeta;

export const AgentMessageActions = () => {
  const [forkedMessage, setForkedMessage] = useState<string>();
  const messages: SessionMessage[] = [
    {
      id: "first",
      role: "assistant",
      createdAt: Date.UTC(2026, 10, 2, 14, 30),
      parts: [{ type: "text", text: "I found two approaches. The first keeps the current layout." }],
    },
    {
      id: "second",
      role: "assistant",
      createdAt: Date.UTC(2026, 10, 2, 14, 32),
      parts: [{ type: "text", text: "The second approach adds a sidebar." }],
    },
  ];
  return (
    <Stack width="480px" gap="md">
      {messages.map((message) => (
        <ChatMessage.Root key={message.id} from="assistant">
          <ChatMessage.Content from="assistant">
            <Text>{message.parts[0].type === "text" ? message.parts[0].text : ""}</Text>
            <HStack gap="2xs">
              <MessageActionPanel message={message} alwaysVisible copyAlwaysVisible />
              <Tooltip content="Fork conversation">
                <IconButton
                  aria-label="Fork conversation"
                  variant="ghost"
                  size="2xs"
                  onClick={() => setForkedMessage(message.id)}
                >
                  <GitFork size={12} />
                </IconButton>
              </Tooltip>
            </HStack>
          </ChatMessage.Content>
        </ChatMessage.Root>
      ))}
      {forkedMessage ? <Text textStyle="label/S/regular">Fork selected: {forkedMessage}</Text> : null}
    </Stack>
  );
};
