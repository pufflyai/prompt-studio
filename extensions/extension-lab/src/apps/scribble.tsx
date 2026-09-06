import { Box, Button, HStack, IconButton, Input, Stack, Text } from "@chakra-ui/react";
import type { PageRef, ResourceRef } from "@pstdio/sdk/extensions";
import { MarkdownEditor } from "@pstdio/ui/rich-text";
import { useSyncExternalStore } from "react";
import { createExampleStore, useExampleStore, usePageResource } from "../example-store";
import { ExampleIcon } from "../icon";
import { documentMarkdown, exampleDefaults } from "../state-defaults";
import type { ExampleHost, ExampleViewInput } from "../view-context";

const page: PageRef = { extensionId: "pstdio.extension-lab", kind: "page", id: "scribble-resource" };
const resource = (id: string): ResourceRef => ({
  type: "scribble.document",
  id,
  label: scribbleStore.getState().documents.find((doc) => doc.id === id)?.title,
});

export const scribbleStore = createExampleStore("scribble", exampleDefaults.scribble);

export const ScribbleTree = (props: { host: ExampleHost }) => {
  const { host } = props;
  const state = useExampleStore(scribbleStore);
  const active = usePageResource(host)?.id;
  const visible = state.documents.filter((doc) => doc.title.toLowerCase().includes(state.query.toLowerCase()));
  return (
    <Stack h="full" gap="md" p="sm">
      <HStack px="sm" py="xs" justify="space-between">
        <HStack gap="sm">
          <Box boxSize="8" borderRadius="md" bg="bg.accent-primary.default" display="grid" placeItems="center">
            <ExampleIcon name="Feather" color="fg.button.primary.default" size={16} />
          </Box>
          <Stack gap="0">
            <Text textStyle="paragraph/S/semibold">Scribble</Text>
            <Text textStyle="paragraph/XS/regular" color="fg.muted">
              Alex's workspace
            </Text>
          </Stack>
        </HStack>
        <ExampleIcon name="ChevronsUpDown" color="fg.muted" size={13} />
      </HStack>
      <Box position="relative">
        <Box position="absolute" insetStart="sm" top="50%" transform="translateY(-50%)">
          <ExampleIcon name="Search" color="fg.muted" />
        </Box>
        <Input
          aria-label="Search pages"
          value={state.query}
          onChange={(event) => scribbleStore.setState({ query: event.target.value })}
          ps="xl"
          size="sm"
          placeholder="Search pages"
        />
      </Box>
      <Stack gap="2xs">
        <Text px="sm" textStyle="label/XS" color="fg.muted">
          WORKSPACE
        </Text>
        {visible.map((doc) => (
          <Button
            key={doc.id}
            aria-current={active === doc.id ? "page" : undefined}
            justifyContent="flex-start"
            size="sm"
            variant={active === doc.id ? "subtle" : "ghost"}
            onClick={() => host.navigate({ kind: "page", page, resource: resource(doc.id) })}
          >
            <ExampleIcon name={doc.icon} />
            <Text truncate>{doc.title}</Text>
            {state.favoriteIds.includes(doc.id) ? <ExampleIcon name="Star" ms="auto" size={12} /> : null}
          </Button>
        ))}
        {visible.length === 0 ? (
          <Text px="sm" color="fg.muted" textStyle="paragraph/S/regular">
            No pages found.
          </Text>
        ) : null}
      </Stack>
      <Button
        mt="auto"
        size="sm"
        variant="ghost"
        justifyContent="flex-start"
        onClick={async () => {
          const id = crypto.randomUUID();
          const doc = {
            ...state.documents[0],
            id,
            title: "Untitled page",
            eyebrow: "PRIVATE NOTE",
            intro: "",
            sections: [],
            tasks: [],
          };
          await scribbleStore.setState({
            documents: [...state.documents, doc],
            contentById: { ...state.contentById, [id]: "" },
          });
          void host.navigate({ kind: "page", page, resource: { type: "scribble.document", id, label: doc.title } });
        }}
      >
        <ExampleIcon name="Plus" />
        New page
      </Button>
    </Stack>
  );
};

export const DocumentCanvas = (props: { input: ExampleViewInput }) => {
  const { input } = props;
  const state = useExampleStore(scribbleStore);
  const pending = useSyncExternalStore(scribbleStore.subscribe, scribbleStore.getPendingCount);
  const doc = scribbleStore.getState().documents.find((item) => item.id === input.resource?.id) ?? state.documents[0];
  const favorite = state.favoriteIds.includes(doc.id);
  const toggleFavorite = () =>
    scribbleStore.setState((current) => ({
      ...current,
      favoriteIds: favorite ? current.favoriteIds.filter((id) => id !== doc.id) : [...current.favoriteIds, doc.id],
    }));
  const markdown = state.contentById[doc.id] ?? documentMarkdown(doc);
  const updateMarkdown = (content: string) =>
    scribbleStore.setState((current) => ({
      ...current,
      contentById: { ...current.contentById, [doc.id]: content },
    }));
  return (
    <Box h="full" overflowY="auto" bg="bg">
      <HStack
        h="12"
        px="md"
        justify="space-between"
        borderBottomWidth="1px"
        borderColor="border.subtle"
        bg="bg"
        position="sticky"
        top="0"
        zIndex="1"
      >
        <HStack gap="xs" color="fg.muted">
          <Text textStyle="paragraph/S/regular">Private</Text>
          <ExampleIcon name="ChevronRight" size={13} />
          <Text textStyle="paragraph/S/semibold" color="fg">
            {doc.title}
          </Text>
        </HStack>
        <HStack gap="xs">
          <Text textStyle="paragraph/XS/regular" color="fg.muted">
            {pending > 0 ? "Saving…" : "Saved locally"}
          </Text>
        </HStack>
      </HStack>
      <Stack maxW="760px" mx="auto" px={{ base: "lg", md: "3xl" }} py="3xl" gap="xl">
        <HStack justify="space-between" align="start">
          <Stack gap="xs">
            <Text textStyle="label/XS" color="fg.muted">
              {doc.eyebrow}
            </Text>
            <HStack align="center" gap="md">
              <ExampleIcon name={doc.icon} size={32} color="fg.muted" />
              <Text textStyle="display/XL/semibold">{doc.title}</Text>
            </HStack>
          </Stack>
          <IconButton
            aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
            variant="ghost"
            onClick={toggleFavorite}
          >
            <ExampleIcon name="Star" color={favorite ? "fg.warning" : "fg.muted"} />
          </IconButton>
        </HStack>
        <MarkdownEditor
          key={doc.id}
          defaultState={markdown}
          fullWidth
          isEditable
          padding="0"
          scrollable={false}
          onChange={updateMarkdown}
        />
      </Stack>
    </Box>
  );
};
