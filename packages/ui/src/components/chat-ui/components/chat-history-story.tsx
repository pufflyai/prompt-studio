import { Box, Button } from "@chakra-ui/react";
import { useState } from "react";
import { ChatPanel } from "./chat-panel";
import type { SessionMessage } from "./message-types";
export const PromptHistoryPanel = (props: { prompts?: string[] }) => {
  const { prompts = ["Explain the project", "Show the next steps", "Summarize the plan"] } = props;
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<SessionMessage[]>(
    prompts.map((text, index) => ({ id: String(index), role: "user", parts: [{ type: "text", text }] })),
  );
  return (
    <Box w="full" h="600px">
      <ChatPanel
        conversationKey="prompt-history"
        messages={messages}
        chatInputDefaultValue={draft}
        onChatInputChange={setDraft}
        emptyStateTitle="Start a conversation"
        emptyStateDescription="Send a prompt"
        chatInputPlaceholder="Use Arrow Up to recall a prompt"
        onSubmitMessage={(text) =>
          setMessages((current) => [
            ...current,
            { id: String(current.length), role: "user", parts: [{ type: "text", text }] },
          ])
        }
      />
    </Box>
  );
};
export const PromptHistoryResetPanel = () => {
  const [conversation, setConversation] = useState(0);
  const [prompt, setPrompt] = useState("Original prompt");
  return (
    <Box w="full" h="600px">
      <Button onClick={() => setConversation((value) => value + 1)}>Switch conversation</Button>
      <Button onClick={() => setPrompt("Updated prompt")}>Update history</Button>
      <ChatPanel
        conversationKey={String(conversation)}
        messages={[{ id: "same-first-message", role: "user", parts: [{ type: "text", text: prompt }] }]}
        emptyStateTitle="Start a conversation"
        emptyStateDescription="Send a prompt"
        chatInputPlaceholder="Use Arrow Up to recall a prompt"
      />
    </Box>
  );
};
