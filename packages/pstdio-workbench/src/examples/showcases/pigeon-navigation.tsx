import { Box, Button, HStack, IconButton, Input, Stack, Text } from "@chakra-ui/react";
import type { WorkbenchCore } from "../../core";
import { WorkbenchIcon } from "../../react";
import { pigeonThreads } from "./pigeon-data";
import { pigeonStore } from "./pigeon-state";
import { useShowcaseStore } from "./showcase-store";

export const PigeonNav = () => {
  const state = useShowcaseStore(pigeonStore);
  return (
    <HStack h="full" px="md" gap="lg">
      <HStack flexShrink={0}>
        <Box boxSize="7" borderRadius="md" bg="bg.accent-primary.default" display="grid" placeItems="center">
          <WorkbenchIcon name="Send" color="fg.button.primary.default" />
        </Box>
        <Text textStyle="heading/S/semibold">Pigeon</Text>
      </HStack>
      <Box position="relative" flex="1" maxW="2xl">
        <Box position="absolute" insetStart="md" top="50%" transform="translateY(-50%)">
          <WorkbenchIcon name="Search" color="fg.muted" />
        </Box>
        <Input
          aria-label="Search mail"
          value={state.query}
          onChange={(event) => pigeonStore.setState({ query: event.target.value })}
          ps="2xl"
          borderRadius="full"
          placeholder="Search mail"
        />
      </Box>
      <HStack ms="auto">
        <IconButton aria-label="Help" size="xs" variant="ghost">
          <WorkbenchIcon name="CircleHelp" />
        </IconButton>
        <IconButton aria-label="Settings" size="xs" variant="ghost">
          <WorkbenchIcon name="Settings" />
        </IconButton>
        <Box boxSize="8" borderRadius="full" bg="bg.muted" display="grid" placeItems="center">
          <Text textStyle="paragraph/XS/semibold">AS</Text>
        </Box>
      </HStack>
    </HStack>
  );
};

export const Folders = (props: { workbench: WorkbenchCore }) => {
  const state = useShowcaseStore(pigeonStore);
  const unread = pigeonThreads.filter((thread) => thread.unread && !state.archivedIds.includes(thread.id)).length;
  const folders = [
    { icon: "Inbox", label: "Inbox", count: unread },
    { icon: "Star", label: "Starred" },
    { icon: "Clock3", label: "Snoozed" },
    { icon: "Send", label: "Sent" },
    { icon: "File", label: "Drafts", count: state.draft.body ? 1 : undefined },
    { icon: "Archive", label: "Archive", count: state.archivedIds.length || undefined },
  ];
  return (
    <Stack h="full" p="sm" gap="lg">
      <Button
        size="md"
        alignSelf="flex-start"
        borderRadius="xl"
        onClick={() => props.workbench.overlays.openOverlay("pigeon.compose")}
      >
        <WorkbenchIcon name="Pencil" />
        Compose
      </Button>
      <Stack gap="2xs">
        {folders.map((folder, index) => (
          <Button key={folder.label} variant={index === 0 ? "subtle" : "ghost"} size="sm" justifyContent="flex-start">
            <WorkbenchIcon name={folder.icon} />
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
