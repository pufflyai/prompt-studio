import { Avatar, Box, Button, CloseButton, Flex, HStack, Input, Stack, Tabs, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { useState } from "react";

export default { title: "Proposals/PS-158 Editing and collaboration", fullscreen: true };

export const Experience = () => {
  const [settings, setSettings] = useState(true);
  const [icons, setIcons] = useState("Prompt Studio");
  return (
    <Stack h="full" minH="0" gap="md" p="md">
      <HStack minW="0" justify="space-between">
        <Text truncate>Project</Text>
        <HStack gap="2xs" minW="0" overflow="hidden" aria-label="Other editors">
          {["Alex Green", "Sam Lee", "+3"].map((name) => (
            <Avatar.Root key={name} size="xs" title={name}>
              <Avatar.Fallback name={name}>{name === "+3" ? name : undefined}</Avatar.Fallback>
            </Avatar.Root>
          ))}
        </HStack>
      </HStack>
      <Box>
        <Text>Title</Text>
        <Input autoFocus w="full" aria-label="Title" defaultValue="Project notes" />
      </Box>
      <HStack>
        <Text color="fg.warning">Connection lost</Text>
        <Text color="fg.muted">Downloading project · 42%</Text>
      </HStack>
      <Tabs.Root defaultValue="trends" flex="1" minH="0">
        <Tabs.List>
          {[["trends", "Trends"], ["compare", "Compare"], ["runs", "Runs"]].map(([value, label]) => (
            <Tabs.Trigger key={value} value={value}>{label}</Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="trends" h="full">
          <Flex h="full" minH="0" minW="0">
            <Stack flex="1" minW="0">
              <HStack>
                <Button onClick={() => setSettings((open) => !open)}>Art settings</Button>
                <Button onClick={() => setIcons((value) => value === "Prompt Studio" ? "Lucide" : "Prompt Studio")}>
                  Icon set: {icons}
                </Button>
              </HStack>
              <Box flex="1" bg="bg.subtle" />
            </Stack>
            {settings ? (
              <Stack w="xs" minW="0" borderLeftWidth="1px" borderColor="border.subtle">
                <HStack justify="space-between" px="sm">
                  <Text>Art settings</Text>
                  <CloseButton aria-label="Close art settings" onClick={() => setSettings(false)} />
                </HStack>
                <ScrollArea><Text px="sm">Recipe controls stay available after reopening.</Text></ScrollArea>
              </Stack>
            ) : null}
          </Flex>
        </Tabs.Content>
        <Tabs.Content value="compare">Compare benchmark results</Tabs.Content>
        <Tabs.Content value="runs">Run benchmarks</Tabs.Content>
      </Tabs.Root>
    </Stack>
  );
};
