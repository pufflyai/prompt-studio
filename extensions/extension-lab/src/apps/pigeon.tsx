import { Badge, Box, Button, HStack, IconButton, Input, Stack, Text, Textarea } from "@chakra-ui/react";
import type { PageRef, ResourceRef } from "@pstdio/sdk/extensions";
import { useEffect } from "react";
import { initials, useExampleStore } from "../example-store";
import { ExampleIcon } from "../icon";
import type { ExampleViewInput } from "../view-context";
import { type PigeonThread, pigeonThreads } from "./pigeon-data";
import { pigeonStore } from "./pigeon-state";

const page: PageRef = { extensionId: "pstdio.extension-lab", kind: "page", id: "pigeon-resource" };
const homePage: PageRef = { extensionId: "pstdio.extension-lab", kind: "page", id: "pigeon" };
const resource = (thread: PigeonThread): ResourceRef => ({
  type: "pigeon.thread",
  id: thread.id,
  label: thread.subject,
});
export const Inbox = (props: { input: ExampleViewInput }) => {
  const state = useExampleStore(pigeonStore);
  const messages =
    state.folder === "Sent"
      ? state.sent.map((message) => ({
          id: message.id,
          sender: message.to,
          subject: message.subject,
          preview: message.body,
          body: [message.body],
          time: "Just now",
          unread: false,
          starred: false,
        }))
      : pigeonThreads.map((thread) => ({ ...thread, unread: thread.unread && !state.readIds.includes(thread.id) }));
  const threads = messages.filter(
    (thread) =>
      (state.folder === "Archive" ? state.archivedIds.includes(thread.id) : !state.archivedIds.includes(thread.id)) &&
      (state.folder !== "Starred" || state.starredIds.includes(thread.id)) &&
      `${thread.sender} ${thread.subject} ${thread.preview}`.toLowerCase().includes(state.query.toLowerCase()),
  );
  return (
    <Stack h="full" position="relative" overflow="hidden" gap="0" bg="bg">
      <HStack px="lg" py="md" justify="space-between" borderBottomWidth="1px" borderColor="border.subtle">
        <Stack gap="0">
          <Text textStyle="heading/M/semibold">{state.folder}</Text>
          <Text color="fg.muted" textStyle="paragraph/S/regular">
            {threads.length} conversations
          </Text>
        </Stack>
        <HStack>
          <IconButton aria-label="Refresh inbox" disabled size="sm" variant="ghost">
            <ExampleIcon name="RefreshCw" />
          </IconButton>
          <IconButton aria-label="More inbox actions" disabled size="sm" variant="ghost">
            <ExampleIcon name="EllipsisVertical" />
          </IconButton>
        </HStack>
      </HStack>
      {state.composing ? (
        <Box position="absolute" inset="0" zIndex="modal" bg="bg.overlay" display="grid" placeItems="center">
          <Composer />
        </Box>
      ) : null}
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
            onClick={() => props.input.host.navigate({ kind: "page", page, resource: resource(thread) })}
          >
            <IconButton
              aria-label={state.starredIds.includes(thread.id) ? `Unstar ${thread.subject}` : `Star ${thread.subject}`}
              size="xs"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation();
                pigeonStore.setState({
                  starredIds: state.starredIds.includes(thread.id)
                    ? state.starredIds.filter((id) => id !== thread.id)
                    : [...state.starredIds, thread.id],
                });
              }}
            >
              <ExampleIcon name="Star" color={state.starredIds.includes(thread.id) ? "fg.warning" : "fg.subtle"} />
            </IconButton>
            <IconButton
              aria-label={`Open message: ${thread.subject}`}
              size="xs"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation();
                props.input.host.navigate({ kind: "page", page, resource: resource(thread) });
              }}
            >
              <ExampleIcon name="MailOpen" />
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
            <ExampleIcon name="Inbox" size={30} color="fg.muted" />
            <Text color="fg.muted">Your inbox is clear.</Text>
          </Stack>
        ) : null}
      </Stack>
    </Stack>
  );
};

export const ReadingPane = (props: { input: ExampleViewInput }) => {
  const { input } = props;
  const state = useExampleStore(pigeonStore);
  const thread = [
    ...pigeonThreads,
    ...state.sent.map((message) => ({
      id: message.id,
      sender: message.to,
      subject: message.subject,
      preview: message.body,
      body: [message.body],
      time: "Just now",
      unread: false,
      starred: false,
    })),
  ].find((item) => item.id === input.resource?.id);
  useEffect(() => {
    if (thread?.unread && !state.readIds.includes(thread.id)) {
      pigeonStore.setState({ readIds: [...state.readIds, thread.id] });
    }
  }, [thread?.id, thread?.unread, state.readIds]);
  if (!thread) return null;
  const archive = () => {
    pigeonStore.setState({ archivedIds: [...state.archivedIds, thread.id] });
    input.host.navigate({ kind: "page", page: homePage });
  };
  return (
    <Stack h="full" overflowY="auto" gap="lg" p="lg">
      <HStack justify="space-between">
        <HStack>
          <IconButton aria-label="Archive thread" size="sm" variant="ghost" onClick={archive}>
            <ExampleIcon name="Archive" />
          </IconButton>
        </HStack>
        <HStack>
          <IconButton
            aria-label="Previous thread"
            onClick={() =>
              input.host.navigate({
                kind: "page",
                page,
                resource: resource(
                  pigeonThreads[
                    (pigeonThreads.findIndex((item) => item.id === thread.id) + pigeonThreads.length - 1) %
                      pigeonThreads.length
                  ],
                ),
              })
            }
            size="sm"
            variant="ghost"
          >
            <ExampleIcon name="ChevronLeft" />
          </IconButton>
          <IconButton
            aria-label="Next thread"
            onClick={() =>
              input.host.navigate({
                kind: "page",
                page,
                resource: resource(
                  pigeonThreads[(pigeonThreads.findIndex((item) => item.id === thread.id) + 1) % pigeonThreads.length],
                ),
              })
            }
            size="sm"
            variant="ghost"
          >
            <ExampleIcon name="ChevronRight" />
          </IconButton>
        </HStack>
      </HStack>
      <Stack gap="sm">
        <HStack align="start">
          <Text flex="1" textStyle="heading/L/semibold">
            {thread.subject}
          </Text>
          <Badge colorPalette="blue">{state.folder}</Badge>
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
        <Button
          variant="outline"
          onClick={() =>
            pigeonStore.setState({
              composing: true,
              draft: { to: thread.sender, subject: `Re: ${thread.subject}`, body: "" },
            })
          }
        >
          <ExampleIcon name="Reply" />
          Reply
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            pigeonStore.setState({
              composing: true,
              draft: { to: "", subject: `Fwd: ${thread.subject}`, body: thread.body.join("\n\n") },
            })
          }
        >
          <ExampleIcon name="Forward" />
          Forward
        </Button>
      </HStack>
    </Stack>
  );
};

export const Composer = () => {
  const state = useExampleStore(pigeonStore);
  const close = () => pigeonStore.setState({ composing: false });
  return (
    <Stack
      w={{ base: "calc(100vw - 2rem)", md: "xl" }}
      maxH="80dvh"
      bg="bg.panel"
      borderRadius="xl"
      overflow="hidden"
      boxShadow="2xl"
      gap="0"
    >
      <HStack px="md" py="sm" bg="bg.muted" justify="space-between">
        <Text textStyle="paragraph/S/semibold">New message</Text>
        <IconButton aria-label="Close composer" size="xs" variant="ghost" onClick={close}>
          <ExampleIcon name="X" />
        </IconButton>
      </HStack>
      <Stack p="md" gap="sm">
        <Input
          aria-label="To"
          variant="flushed"
          placeholder="To"
          value={state.draft.to}
          onChange={(event) => pigeonStore.setState({ draft: { ...state.draft, to: event.target.value } })}
        />
        <Input
          aria-label="Subject"
          variant="flushed"
          placeholder="Subject"
          value={state.draft.subject}
          onChange={(event) => pigeonStore.setState({ draft: { ...state.draft, subject: event.target.value } })}
        />
        <Textarea
          aria-label="Message body"
          minH="48"
          border="0"
          resize="none"
          placeholder="Write a message"
          value={state.draft.body}
          onChange={(event) => pigeonStore.setState({ draft: { ...state.draft, body: event.target.value } })}
        />
        <HStack justify="space-between">
          <Button
            disabled={!state.draft.to || !state.draft.subject || !state.draft.body}
            onClick={() =>
              pigeonStore.setState({
                sent: [...state.sent, { id: crypto.randomUUID(), ...state.draft }],
                draft: { to: "", subject: "", body: "" },
                composing: false,
              })
            }
          >
            <ExampleIcon name="Send" />
            Send
          </Button>
          <IconButton
            aria-label="Discard draft"
            variant="ghost"
            onClick={() => {
              pigeonStore.setState({ draft: { to: "", subject: "", body: "" } });
              close();
            }}
          >
            <ExampleIcon name="Trash2" />
          </IconButton>
        </HStack>
      </Stack>
    </Stack>
  );
};
