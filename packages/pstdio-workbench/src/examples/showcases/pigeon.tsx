import { Badge, Box, Button, HStack, IconButton, Input, Stack, Text, Textarea } from "@chakra-ui/react";
import type { PageRef, ResourceRef } from "@pstdio/sdk/extensions";
import { createWorkbench, type WorkbenchPanelRenderInput } from "../../core";
import { WorkbenchIcon } from "../../react";
import { type PigeonThread, pigeonThreads } from "./pigeon-data";
import { Folders, PigeonNav } from "./pigeon-navigation";
import { pigeonStore } from "./pigeon-state";
import { initials, useShowcaseStore } from "./showcase-store";
import { pigeonTheme } from "./themes";

const page: PageRef = { extensionId: "storybook.showcases", kind: "page", id: "pigeon" };
const resource = (thread: PigeonThread): ResourceRef => ({
  type: "pigeon.thread",
  id: thread.id,
  label: thread.subject,
});
const Inbox = (props: { input: WorkbenchPanelRenderInput }) => {
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
              props.input.workbench.pageLocations.navigate({ kind: "page", page, resource: resource(thread) })
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
                props.input.workbench.pageLocations.navigate({ kind: "page", page, resource: resource(thread) });
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

const ReadingPane = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const state = useShowcaseStore(pigeonStore);
  const thread = pigeonThreads.find((item) => item.id === input.instance.resource?.id);
  if (!thread) return null;
  const archive = () => {
    pigeonStore.setState({ archivedIds: [...state.archivedIds, thread.id] });
    input.workbench.pageLocations.navigate({ kind: "page", page });
  };
  return (
    <Stack h="full" overflowY="auto" gap="lg" p="lg">
      <HStack justify="space-between">
        <HStack>
          <IconButton
            aria-label="Back to inbox"
            size="sm"
            variant="ghost"
            onClick={() => input.workbench.pageLocations.navigate({ kind: "page", page })}
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

const Composer = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const state = useShowcaseStore(pigeonStore);
  const close = () => input.workbench.overlays.closeOverlay(input.instance.instanceId);
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
          <WorkbenchIcon name="X" />
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
          <Button onClick={close}>
            <WorkbenchIcon name="Send" />
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
            <WorkbenchIcon name="Trash2" />
          </IconButton>
        </HStack>
      </Stack>
    </Stack>
  );
};

export const createPigeonWorkbench = () => {
  const workbench = createWorkbench({ startPage: page, initialSidePanelMode: "floating" });
  workbench.themes.register([pigeonTheme]);
  workbench.modes.registerMode({
    id: "pigeon",
    label: "Pigeon",
    resourceKinds: ["pigeon.thread"],
    regionSettings: {
      sidenav: { size: { defaultPx: 220, minPx: 200, maxPx: 280 }, collapsible: false },
      side: { size: { defaultPx: 480, minPx: 360, maxPx: 600 } },
    },
    activate: () => undefined,
  });
  workbench.views.registerView({
    id: "pigeon.nav",
    title: "Pigeon",
    body: { kind: "react", render: () => <PigeonNav /> },
  });
  workbench.views.registerView({
    id: "pigeon.folders",
    title: "Folders",
    body: { kind: "react", render: (input) => <Folders workbench={input.workbench} /> },
  });
  workbench.views.registerView({
    id: "pigeon.inbox",
    title: "Inbox",
    body: { kind: "react", render: (input) => <Inbox input={input} /> },
  });
  workbench.views.registerView({
    id: "pigeon.reader",
    title: "Message",
    body: { kind: "react", render: (input) => <ReadingPane input={input} /> },
  });
  workbench.views.registerView({
    id: "pigeon.composer",
    title: "New message",
    body: { kind: "react", render: (input) => <Composer input={input} /> },
  });
  workbench.shellPlacements.registerPlacement({
    id: "pigeon.nav",
    item: { kind: "view", viewId: "pigeon.nav", presence: "fixed" },
    region: "nav",
  });
  workbench.overlays.registerOverlay({ id: "pigeon.compose", viewId: "pigeon.composer", closable: true });
  workbench.pages.registerPage({
    id: "pigeon.inbox",
    ref: page,
    title: "Inbox",
    path: "pigeon/inbox",
    modeId: "pigeon",
    slots: [
      { id: "folders", role: "auxiliary", region: "sidenav", viewId: "pigeon.folders", presence: "fixed" },
      {
        id: "inbox",
        role: "primary",
        region: "main",
        viewId: "pigeon.inbox",
        binding: { resourceKinds: ["pigeon.thread"], viewId: "pigeon.inbox", cardinality: "one" },
        floatingPanels: "visible",
      },
      {
        id: "reader",
        role: "auxiliary",
        region: "side",
        binding: { resourceKinds: ["pigeon.thread"], viewId: "pigeon.reader", cardinality: "one" },
        openOn: "page-resource",
        floatingPanels: "visible",
      },
    ],
  });
  workbench.pageLocations.switchProject("storybook-pigeon");
  return workbench;
};
