import { Box, Button, Flex, Stack } from "@chakra-ui/react";
import { useState } from "react";
import { ChatPanel } from "../../components/chat-ui/components/chat-panel";
import type { SessionMessage } from "../../components/chat-ui/components/message-types";
import { Tooltip } from "../../components/primitives/tooltip";

export default { title: "Proposals/PS-295 Session panel", fullscreen: true };

const turns = [
  ["Prepare a release build.", "The Linux and macOS builds are ready."],
  ["Check the Windows build too.", "The installer passed its smoke test."],
  ["Did you start the nightly?", "Yes. The nightly is running from main."],
];

const messages = turns.flatMap(([prompt, reply], index): SessionMessage[] => [
  {
    id: `prompt-${index}`,
    role: "user",
    createdAt: Date.UTC(2026, 10, 25, 13, 31 + index),
    ...(index === 1 ? { sender: { type: "session", id: "brisk-iris", name: "brisk-iris" } } : {}),
    parts: [{ type: "text", text: prompt }],
  },
  { id: `reply-${index}`, role: "assistant", parts: [{ type: "text", text: reply }] },
]);

export const Conversation = () => {
  const [menu, setMenu] = useState(false);
  return (
    <Stack h="full" bg="bg" gap="0">
      <Flex borderBottomWidth="1px" p="xs" gap="xs" align="center">
        <Tooltip content="calm-ada">
          <Button variant="ghost" size="xs">
            Release checks
          </Button>
        </Tooltip>
        <Button size="xs" variant="ghost" aria-label="Session actions" onClick={() => setMenu(!menu)}>
          …
        </Button>
        {menu && (
          <Button
            size="xs"
            onClick={() => {
              void navigator.clipboard.writeText("calm-ada");
              setMenu(false);
            }}
          >
            Copy session nickname
          </Button>
        )}
      </Flex>
      <Box flex="1" minH="0">
        <ChatPanel
          messages={messages}
          emptyStateTitle="No messages"
          emptyStateDescription="Start a conversation."
          chatInputPlaceholder="Reply…"
          hideComposer
        />
      </Box>
    </Stack>
  );
};
