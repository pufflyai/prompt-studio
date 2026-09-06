import { Box, Button, HStack, IconButton, Input, Stack, Text } from "@chakra-ui/react";
import type { PageRef, ResourceRef } from "@pstdio/sdk/extensions";
import { MarkdownEditor } from "@pstdio/ui/rich-text";
import { createWorkbench, type WorkbenchCore, type WorkbenchPanelRenderInput } from "../../core";
import { WorkbenchIcon } from "../../react";
import { scribbleDocuments } from "./scribble-data";
import { createShowcaseStore, usePrimaryResource, useShowcaseStore } from "./showcase-store";
import { scribbleTheme } from "./themes";

const page: PageRef = { extensionId: "storybook.showcases", kind: "page", id: "scribble-resource" };
const homePage: PageRef = { ...page, id: "scribble" };
const resource = (id: string): ResourceRef => ({
  type: "scribble.document",
  id,
  label: scribbleDocuments.find((doc) => doc.id === id)?.title,
});

const documentMarkdown = (document: (typeof scribbleDocuments)[number]) => {
  const sections = document.sections.flatMap((section) => [`## ${section.title}`, "", section.body, ""]);
  const tasks = document.tasks.map((task, index) => {
    const checked = document.id === "north-star" && index === 0;
    return `- [${checked ? "x" : " "}] ${task}`;
  });

  return [document.intro, "", ...sections, "## Next steps", "", ...tasks].join("\n");
};

const store = createShowcaseStore({
  query: "",
  favoriteIds: ["north-star"],
  contentById: Object.fromEntries(scribbleDocuments.map((document) => [document.id, documentMarkdown(document)])),
});

const ScribbleTree = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const state = useShowcaseStore(store);
  const active = usePrimaryResource(workbench)?.id;
  const visible = scribbleDocuments.filter((doc) => doc.title.toLowerCase().includes(state.query.toLowerCase()));
  return (
    <Stack h="full" gap="md" p="sm">
      <HStack px="sm" py="xs" justify="space-between">
        <HStack gap="sm">
          <Box boxSize="8" borderRadius="md" bg="bg.accent-primary.default" display="grid" placeItems="center">
            <WorkbenchIcon name="Feather" color="fg.button.primary.default" size={16} />
          </Box>
          <Stack gap="0">
            <Text textStyle="paragraph/S/semibold">Scribble</Text>
            <Text textStyle="paragraph/XS/regular" color="fg.muted">
              Alex's workspace
            </Text>
          </Stack>
        </HStack>
        <WorkbenchIcon name="ChevronsUpDown" color="fg.muted" size={13} />
      </HStack>
      <Box position="relative">
        <Box position="absolute" insetStart="sm" top="50%" transform="translateY(-50%)">
          <WorkbenchIcon name="Search" color="fg.muted" />
        </Box>
        <Input
          aria-label="Search pages"
          value={state.query}
          onChange={(event) => store.setState({ query: event.target.value })}
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
            onClick={() => workbench.pageLocations.navigate({ kind: "page", page, resource: resource(doc.id) })}
          >
            <WorkbenchIcon name={doc.icon} />
            <Text truncate>{doc.title}</Text>
            {state.favoriteIds.includes(doc.id) ? <WorkbenchIcon name="Star" ms="auto" size={12} /> : null}
          </Button>
        ))}
        {visible.length === 0 ? (
          <Text px="sm" color="fg.muted" textStyle="paragraph/S/regular">
            No pages found.
          </Text>
        ) : null}
      </Stack>
      <Button mt="auto" size="sm" variant="ghost" justifyContent="flex-start">
        <WorkbenchIcon name="Plus" />
        New page
      </Button>
    </Stack>
  );
};

const DocumentCanvas = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const state = useShowcaseStore(store);
  const doc = scribbleDocuments.find((item) => item.id === input.instance.resource?.id) ?? scribbleDocuments[0];
  const favorite = state.favoriteIds.includes(doc.id);
  const toggleFavorite = () =>
    store.setState((current) => ({
      ...current,
      favoriteIds: favorite ? current.favoriteIds.filter((id) => id !== doc.id) : [...current.favoriteIds, doc.id],
    }));
  const markdown = state.contentById[doc.id] ?? documentMarkdown(doc);
  const updateMarkdown = (content: string) =>
    store.setState((current) => ({
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
          <WorkbenchIcon name="ChevronRight" size={13} />
          <Text textStyle="paragraph/S/semibold" color="fg">
            {doc.title}
          </Text>
        </HStack>
        <HStack gap="xs">
          <Text textStyle="paragraph/XS/regular" color="fg.muted">
            Edited just now
          </Text>
          <Button size="xs" variant="ghost">
            Share
          </Button>
          <IconButton aria-label="More page actions" size="xs" variant="ghost">
            <WorkbenchIcon name="Ellipsis" />
          </IconButton>
        </HStack>
      </HStack>
      <Stack maxW="760px" mx="auto" px={{ base: "lg", md: "3xl" }} py="3xl" gap="xl">
        <HStack justify="space-between" align="start">
          <Stack gap="xs">
            <Text textStyle="label/XS" color="fg.muted">
              {doc.eyebrow}
            </Text>
            <HStack align="center" gap="md">
              <WorkbenchIcon name={doc.icon} size={32} color="fg.muted" />
              <Text textStyle="display/XL/semibold">{doc.title}</Text>
            </HStack>
          </Stack>
          <IconButton
            aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
            variant="ghost"
            onClick={toggleFavorite}
          >
            <WorkbenchIcon name="Star" color={favorite ? "fg.warning" : "fg.muted"} />
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

export const createScribbleWorkbench = () => {
  const workbench = createWorkbench({ startPage: homePage });
  workbench.themes.register([scribbleTheme]);
  workbench.modes.registerMode({
    id: "scribble",
    label: "Scribble",
    resourceKinds: ["scribble.document"],
    regionSettings: {
      sidenav: { size: { defaultPx: 240, minPx: 200, maxPx: 320 }, collapsible: false },
    },
    activate: () => undefined,
  });
  workbench.views.registerView({
    id: "scribble.tree",
    title: "Pages",
    body: { kind: "react", render: (input) => <ScribbleTree workbench={input.workbench} /> },
  });
  workbench.views.registerView({
    id: "scribble.document",
    title: "Document",
    body: { kind: "react", render: (input) => <DocumentCanvas input={input} /> },
  });
  workbench.views.registerView({
    id: "scribble.sync",
    title: "Sync status",
    body: {
      kind: "react",
      render: () => (
        <HStack h="full" px="sm" gap="xs">
          <WorkbenchIcon name="CloudCheck" size={12} />
          <Text textStyle="paragraph/XS/regular">Saved just now</Text>
        </HStack>
      ),
    },
  });
  workbench.statusBar.registerItem({ id: "scribble.sync", viewId: "scribble.sync", slot: "trailing" });
  workbench.modePlacements.registerPlacement({
    id: "scribble.pages",
    ref: { extensionId: "storybook.showcases", kind: "placement", id: "scribble.pages" },
    modeId: "scribble",
    region: "sidenav",
    item: { kind: "view", viewId: "scribble.tree", presence: "fixed" },
  });
  workbench.pages.registerPage({
    id: "scribble.home",
    ref: homePage,
    title: "Scribble",
    path: "scribble",
    modeId: "scribble",
    slots: [{ id: "document", role: "primary", region: "main", viewId: "scribble.document" }],
  });
  workbench.pages.registerPage({
    id: "scribble.resource",
    ref: page,
    title: "Scribble",
    path: "scribble/resource",
    modeId: "scribble",
    parentId: "scribble.home",
    slots: [
      {
        id: "document",
        role: "primary",
        region: "main",
        binding: { resourceKinds: ["scribble.document"], viewId: "scribble.document", cardinality: "one" },
      },
    ],
  });
  workbench.pageLocations.switchProject("storybook-scribble");
  workbench.pageLocations.navigate({ kind: "page", page, resource: resource(scribbleDocuments[0].id) });
  return workbench;
};
