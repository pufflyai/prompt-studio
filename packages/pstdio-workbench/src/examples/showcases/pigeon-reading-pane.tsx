import { Badge, Box, Button, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import type { WorkbenchPanelRenderInput } from "../../core";
import { WorkbenchIcon } from "../../react";
import { pigeonThreads } from "./pigeon-data";
import { pigeonHomePage } from "./pigeon-pages";
import { pigeonStore } from "./pigeon-state";
import { initials, useShowcaseStore } from "./showcase-store";

export const PigeonReadingPane = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const state = useShowcaseStore(pigeonStore);
  const thread = pigeonThreads.find((item) => item.id === input.instance.resource?.id);
  if (!thread) return null;
  const archive = () => {
    pigeonStore.setState({ archivedIds: [...state.archivedIds, thread.id] });
    input.workbench.pageLocations.navigate({ kind: "page", page: pigeonHomePage });
  };
  return (
    <Stack h="full" overflowY="auto" gap="lg" p="lg">
      <HStack justify="space-between">
        <HStack>
          <IconButton
            aria-label="Back to inbox"
            size="sm"
            variant="ghost"
            onClick={() => input.workbench.pageLocations.navigate({ kind: "page", page: pigeonHomePage })}
          >
            <WorkbenchIcon name="ArrowLeft" />
          </IconButton>
          <IconButton aria-label="Archive thread" size="sm" variant="ghost" onClick={archive}>
            <WorkbenchIcon name="Archive" />
          </IconButton>
        </HStack>
        <HStack>
          <IconButton aria-label="Previous thread" size="sm" variant="ghost">
            <WorkbenchIcon name="ChevronLeft" />
          </IconButton>
          <IconButton aria-label="Next thread" size="sm" variant="ghost">
            <WorkbenchIcon name="ChevronRight" />
          </IconButton>
        </HStack>
      </HStack>
      <Stack gap="sm">
        <HStack align="start">
          <Text flex="1" textStyle="heading/L/semibold">
            {thread.subject}
          </Text>
          <Badge colorPalette="blue">Inbox</Badge>
        </HStack>
        <HStack>
          <Box boxSize="10" borderRadius="full" bg="bg.muted" display="grid" placeItems="center">
            <Text textStyle="paragraph/XS/semibold">{initials(thread.sender)}</Text>
          </Box>
          <Stack gap="0" flex="1">
            <Text textStyle="paragraph/S/semibold">{thread.sender}</Text>
            <Text color="fg.muted" textStyle="paragraph/XS/regular">
              to me
            </Text>
          </Stack>
          <Text color="fg.muted" textStyle="paragraph/XS/regular">
            {thread.time}
          </Text>
        </HStack>
      </Stack>
      <Stack gap="md">
        {thread.body.map((paragraph) => (
          <Text key={paragraph} textStyle="paragraph/M/regular" lineHeight="tall">
            {paragraph}
          </Text>
        ))}
      </Stack>
      <HStack>
        <Button variant="outline">
          <WorkbenchIcon name="Reply" />
          Reply
        </Button>
        <Button variant="outline">
          <WorkbenchIcon name="Forward" />
          Forward
        </Button>
      </HStack>
    </Stack>
  );
};
