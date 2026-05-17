import { Box, Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";

interface StreamingChatProps {
  channel: string;
}

interface Message {
  id: number;
  body: string;
}

// Mock streaming chat: a single subtree that owns scroll position, an input
// draft, and an incrementing message stream. Used by the keep-alive story to
// show that toggling between bridge widgets preserves all three.
export const StreamingChat = (props: StreamingChatProps) => {
  const { channel } = props;
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const sequenceRef = useRef(0);

  useEffect(() => {
    const handle = setInterval(() => {
      sequenceRef.current += 1;
      const id = sequenceRef.current;
      setMessages((current) => [...current, { id, body: `${channel} token #${id}` }]);
    }, 800);
    return () => clearInterval(handle);
  }, [channel]);

  const messageCount = messages.length;
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    if (messageCount > 0) node.scrollTop = node.scrollHeight;
  }, [messageCount]);

  const sendDraft = () => {
    if (!draft.trim()) return;
    sequenceRef.current += 1;
    const id = sequenceRef.current;
    setMessages((current) => [...current, { id, body: `you: ${draft}` }]);
    setDraft("");
    inputRef.current?.focus();
  };

  return (
    <Stack gap="sm" h="full" minH="0" p="md">
      <Text textStyle="label/S/semibold">Streaming chat ({channel})</Text>
      <Box ref={scrollRef} flex="1" minH="0" overflowY="auto" borderWidth="1px" borderColor="border.muted" p="sm">
        <Stack gap="2xs">
          {messages.map((message) => (
            <Text key={message.id} textStyle="paragraph/S/regular">
              {message.body}
            </Text>
          ))}
        </Stack>
      </Box>
      <HStack gap="xs">
        <Input
          ref={inputRef}
          value={draft}
          placeholder="Type a draft… (preserved across moves)"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") sendDraft();
          }}
        />
        <Button size="sm" onClick={sendDraft}>
          Send
        </Button>
      </HStack>
    </Stack>
  );
};
