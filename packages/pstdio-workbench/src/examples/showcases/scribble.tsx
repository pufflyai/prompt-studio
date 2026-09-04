import { Box, Button, HStack, IconButton, Input, Stack, Text } from "@chakra-ui/react";
import type { PageRef, ResourceRef } from "@pstdio/sdk/extensions";
import { createWorkbench, type WorkbenchCore, type WorkbenchPanelRenderInput } from "../../core";
import { WorkbenchIcon } from "../../react";
import { scribbleDocuments } from "./scribble-data";
import { createShowcaseStore, usePrimaryResource, useShowcaseStore } from "./showcase-store";
import { scribbleTheme } from "./themes";

const page: PageRef = { extensionId: "storybook.showcases", kind: "page", id: "scribble" };
const resource = (id: string): ResourceRef => ({
  type: "scribble.document",
  id,
  label: scribbleDocuments.find((doc) => doc.id === id)?.title,
});
const store = createShowcaseStore({ query: "", favoriteIds: ["north-star"], checkedIds: ["north-star:0"] });

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
  const toggleTask = (index: number) => {
    const key = `${doc.id}:${index}`;
    store.setState((current) => ({
      ...current,
      checkedIds: current.checkedIds.includes(key)
        ? current.checkedIds.filter((id) => id !== key)
        : [...current.checkedIds, key],
    }));
  };
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
        <Text textStyle="paragraph/L/regular" color="fg.muted">
          {doc.intro}
        </Text>
        {doc.sections.map((section) => (
          <Stack key={section.title} gap="sm">
            <Text textStyle="heading/M/semibold">{section.title}</Text>
            <Text textStyle="paragraph/M/regular" lineHeight="tall">
              {section.body}
            </Text>
          </Stack>
        ))}
        <Stack gap="sm">
          <Text textStyle="heading/M/semibold">Next steps</Text>
          {doc.tasks.map((task, index) => {
            const key = `${doc.id}:${index}`;
            const checked = state.checkedIds.includes(key);
            return (
              <Button
                key={task}
                aria-pressed={checked}
                variant="ghost"
                justifyContent="flex-start"
                onClick={() => toggleTask(index)}
              >
                <WorkbenchIcon
                  name={checked ? "SquareCheckBig" : "Square"}
                  color={checked ? "fg.success" : "fg.muted"}
                />
                <Text textDecoration={checked ? "line-through" : undefined} color={checked ? "fg.muted" : "fg"}>
                  {task}
                </Text>
              </Button>
            );
          })}
        </Stack>
      </Stack>
    </Box>
  );
};

export const createScribbleWorkbench = () => {
  const workbench = createWorkbench({ startPage: page });
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
  workbench.pages.registerPage({
    id: "scribble.home",
    ref: page,
    title: "Scribble",
    path: "scribble",
    modeId: "scribble",
    slots: [
      { id: "pages", role: "auxiliary", region: "sidenav", viewId: "scribble.tree", presence: "fixed" },
      {
        id: "document",
        role: "primary",
        region: "main",
        viewId: "scribble.document",
        binding: { resourceKinds: ["scribble.document"], viewId: "scribble.document", cardinality: "one" },
      },
    ],
  });
  workbench.pageLocations.switchProject("storybook-scribble");
  workbench.pageLocations.navigate({ kind: "page", page, resource: resource(scribbleDocuments[0].id) });
  return workbench;
};
