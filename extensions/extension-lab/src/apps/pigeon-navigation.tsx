import { Box, Button, HStack, IconButton, Input, InputGroup, Stack, Text } from "@chakra-ui/react";
import { useExampleStore } from "../example-store";
import { ExampleIcon } from "../icon";
import type { ExampleHost } from "../view-context";
import { BackToProject } from "./back-to-project";
import { pigeonThreads } from "./pigeon-data";
import { pigeonStore } from "./pigeon-state";

export const PigeonNav = () => {
  const state = useExampleStore(pigeonStore);
  return (
    <HStack h="full" px="md" gap="lg">
      <BackToProject />
      <HStack flexShrink={0}>
        <Box boxSize="7" borderRadius="md" bg="bg.accent-primary.default" display="grid" placeItems="center">
          <ExampleIcon name="Send" color="fg.button.primary.default" />
        </Box>
        <Text textStyle="heading/S/semibold">Pigeon</Text>
      </HStack>
      <InputGroup flex="1" maxW="2xl" startElement={<ExampleIcon name="Search" color="fg.muted" />}>
        <Input
          aria-label="Search mail"
          value={state.query}
          onChange={(event) => pigeonStore.setState({ query: event.target.value })}
          size="sm"
          placeholder="Search mail"
        />
      </InputGroup>
      <HStack ms="auto">
        <IconButton aria-label="Help" disabled size="xs" variant="ghost">
          <ExampleIcon name="CircleQuestionMark" />
        </IconButton>
        <IconButton aria-label="Settings" disabled size="xs" variant="ghost">
          <ExampleIcon name="Settings" />
        </IconButton>
      </HStack>
    </HStack>
  );
};

export const Folders = (_props: { host: ExampleHost }) => {
  const state = useExampleStore(pigeonStore);
  const unread = pigeonThreads.filter(
    (thread) => thread.unread && !state.readIds.includes(thread.id) && !state.archivedIds.includes(thread.id),
  ).length;
  const folders = [
    { icon: "Inbox", label: "Inbox", count: unread },
    { icon: "Star", label: "Starred" },
    { icon: "Clock3", label: "Snoozed", disabled: true },
    { icon: "Send", label: "Sent" },
    { icon: "File", label: "Drafts", count: state.draft.body ? 1 : undefined },
    { icon: "Archive", label: "Archive", count: state.archivedIds.length || undefined },
  ];
  return (
    <Stack h="full" p="sm" gap="lg">
      <Button size="sm" alignSelf="flex-start" onClick={() => pigeonStore.setState({ composing: true })}>
        <ExampleIcon name="Pencil" />
        Compose
      </Button>
      <Stack gap="2xs">
        {folders.map((folder) => (
          <Button
            key={folder.label}
            variant={state.folder === folder.label ? "subtle" : "ghost"}
            size="sm"
            disabled={folder.disabled}
            justifyContent="flex-start"
            onClick={() => pigeonStore.setState({ folder: folder.label, composing: folder.label === "Drafts" })}
          >
            <ExampleIcon name={folder.icon} />
            {folder.label}
            {folder.count ? (
              <Text ms="auto" textStyle="paragraph/XS/semibold">
                {folder.count}
              </Text>
            ) : null}
          </Button>
        ))}
      </Stack>
      <HStack mt="auto" p="sm">
        <Box boxSize="8" borderRadius="full" bg="bg.muted" display="grid" placeItems="center">
          <Text textStyle="paragraph/XS/semibold">AS</Text>
        </Box>
        <Stack gap="0">
          <Text textStyle="paragraph/S/semibold">Alex Stone</Text>
          <Text color="fg.muted" textStyle="paragraph/XS/regular">
            alex@pigeon.test
          </Text>
        </Stack>
      </HStack>
    </Stack>
  );
};
