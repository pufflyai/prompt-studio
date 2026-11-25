import { Avatar, Box, Button, Flex, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { ChatMessage } from "../../components/chat-ui/components/ai-message";
import { Tooltip } from "../../components/primitives/tooltip";

export default { title: "Proposals/PS-295 Session panel", fullscreen: true };

const turns = [
  ["Prepare a release build.", "The Linux and macOS builds are ready."],
  ["Check the Windows build too.", "The installer passed its smoke test."],
  ["Did you start the nightly?", "Yes. Nightly #2892 is running from main."],
];
export const Conversation = () => {
  const [current, setCurrent] = useState(2);
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
      <Flex flex="1" minH="0" align="center" containerType="inline-size">
        <Stack
          as="nav"
          aria-label="Conversation outline"
          gap="0"
          p="xs"
          css={{ display: "none", "@container (min-width: 52rem)": { display: "flex" } }}
        >
          {turns.map(([prompt, reply], index) => (
            <Tooltip
              key={prompt}
              positioning={{ placement: "right" }}
              content={
                <Stack>
                  <Text>{prompt}</Text>
                  <Text color="fg.muted">{reply}</Text>
                </Stack>
              }
            >
              <Button aria-label={prompt} size="xs" variant="ghost" onClick={() => setCurrent(index)}>
                <Box w={index === current ? "5" : "2"} h="0.5" bg={index === current ? "fg" : "fg.muted"} />
              </Button>
            </Tooltip>
          ))}
        </Stack>
        <Stack layerStyle="chatContent" p="sm">
          <ChatMessage.Root from="user">
            <ChatMessage.Content from="user">
              {current === 1 && (
                <Tooltip content="brisk-iris">
                  <Avatar.Root size="xs">
                    <Avatar.Fallback name="Brisk Iris" />
                  </Avatar.Root>
                </Tooltip>
              )}
              {turns[current][0]}
            </ChatMessage.Content>
          </ChatMessage.Root>
          <ChatMessage.Root from="assistant">
            <ChatMessage.Content from="assistant">{turns[current][1]}</ChatMessage.Content>
          </ChatMessage.Root>
        </Stack>
      </Flex>
    </Stack>
  );
};
