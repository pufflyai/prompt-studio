import { Box, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import type { WorkbenchPanelRenderInput } from "../../core";
import { WorkbenchIcon } from "../../react";
import { pigeonThreads } from "./pigeon-data";
import { pigeonResourcePage, pigeonThreadResource } from "./pigeon-pages";
import { pigeonStore } from "./pigeon-state";
import { initials, useShowcaseStore } from "./showcase-store";

export const PigeonInbox = (props: { input: WorkbenchPanelRenderInput }) => {
  const state = useShowcaseStore(pigeonStore);
  const threads = pigeonThreads.filter(
    (thread) =>
      !state.archivedIds.includes(thread.id) &&
      `${thread.sender} ${thread.subject} ${thread.preview}`.toLowerCase().includes(state.query.toLowerCase()),
  );
  return (
    <Stack h="full" overflow="hidden" gap="0" bg="bg">
      <HStack px="lg" py="md" justify="space-between" borderBottomWidth="1px" borderColor="border.subtle">
        <Stack gap="0">
          <Text textStyle="heading/M/semibold">Inbox</Text>
          <Text color="fg.muted" textStyle="paragraph/S/regular">
            {threads.length} conversations
          </Text>
        </Stack>
        <HStack>
          <IconButton aria-label="Refresh inbox" size="sm" variant="ghost">
            <WorkbenchIcon name="RefreshCw" />
          </IconButton>
          <IconButton aria-label="More inbox actions" size="sm" variant="ghost">
            <WorkbenchIcon name="MoreVertical" />
          </IconButton>
        </HStack>
      </HStack>
      <Stack overflowY="auto" gap="0">
        {threads.map((thread) => (
          <HStack
            key={thread.id}
            px="lg"
            py="md"
            borderBottomWidth="1px"
            borderColor="border.subtle"
            bg={thread.unread ? "bg.subtle" : undefined}
            _hover={{ bg: "bg.hover" }}
            cursor="pointer"
            onClick={() =>
              props.input.workbench.pageLocations.navigate({
                kind: "page",
                page: pigeonResourcePage,
                resource: pigeonThreadResource(thread),
              })
            }
          >
            <IconButton
              aria-label={thread.starred ? `Unstar ${thread.subject}` : `Star ${thread.subject}`}
              size="xs"
              variant="ghost"
              onClick={(event) => event.stopPropagation()}
            >
              <WorkbenchIcon name="Star" color={thread.starred ? "fg.warning" : "fg.subtle"} />
            </IconButton>
            <IconButton
              aria-label={`Open message: ${thread.subject}`}
              size="xs"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation();
                props.input.workbench.pageLocations.navigate({
                  kind: "page",
                  page: pigeonResourcePage,
                  resource: pigeonThreadResource(thread),
                });
              }}
            >
              <WorkbenchIcon name="MailOpen" />
            </IconButton>
            <Box boxSize="9" borderRadius="full" bg="bg.muted" display="grid" placeItems="center">
              <Text textStyle="paragraph/XS/semibold">{initials(thread.sender)}</Text>
            </Box>
            <Stack minW="0" flex="1" gap="xs">
              <HStack>
                <Text truncate flex="1" textStyle={thread.unread ? "paragraph/S/semibold" : "paragraph/S/regular"}>
                  {thread.sender}
                </Text>
                <Text color="fg.muted" textStyle="paragraph/XS/regular">
                  {thread.time}
                </Text>
              </HStack>
              <Text truncate textStyle={thread.unread ? "paragraph/S/semibold" : "paragraph/S/regular"}>
                {thread.subject}
              </Text>
              <Text truncate color="fg.muted" textStyle="paragraph/S/regular">
                {thread.preview}
              </Text>
            </Stack>
          </HStack>
        ))}
        {threads.length === 0 ? (
          <Stack align="center" py="3xl">
            <WorkbenchIcon name="Inbox" size={30} color="fg.muted" />
            <Text color="fg.muted">Your inbox is clear.</Text>
          </Stack>
        ) : null}
      </Stack>
    </Stack>
  );
};
