import { HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import type { PageRef, ResourceRef } from "@pstdio/sdk/extensions";
import { ScrollArea } from "@pstdio/ui";
import { MarkdownEditor } from "@pstdio/ui/rich-text";
import { createWorkbench, type WorkbenchPanelRenderInput } from "../../core";
import { WorkbenchIcon } from "../../react";
import { type ScribbleDocument, scribbleDocuments } from "./scribble-data";
import { createShowcaseStore, type ShowcaseStore, useShowcaseStore } from "./showcase-store";
import { scribbleTheme } from "./themes";

const page: PageRef = { extensionId: "storybook.showcases", kind: "page", id: "scribble-resource" };
const homePage: PageRef = { ...page, id: "scribble" };
const viewer = { kind: "placement", extensionId: "storybook.showcases", id: "scribble-document" } as const;
const resource = (document: ScribbleDocument): ResourceRef => ({
  type: "scribble.document",
  id: document.id,
  label: document.title,
});
const documentMarkdown = (document: ScribbleDocument) =>
  [
    document.intro,
    "",
    ...document.sections.flatMap((section) => [`## ${section.title}`, "", section.body, ""]),
    "## Next steps",
    "",
    ...document.tasks.map((task) => `- [ ] ${task}`),
  ].join("\n");
interface ScribbleState {
  documents: readonly ScribbleDocument[];
  favoriteIds: string[];
  contentById: Record<string, string>;
}
interface DocumentCanvasProps {
  input: WorkbenchPanelRenderInput;
  store: ShowcaseStore<ScribbleState>;
}
const DocumentCanvas = (props: DocumentCanvasProps) => {
  const { input, store } = props;
  const state = useShowcaseStore(store);
  const doc = state.documents.find((item) => item.id === input.instance.resource?.id);
  if (!doc) return null;
  const favorite = state.favoriteIds.includes(doc.id);
  return (
    <ScrollArea h="full" bg="bg">
      <Stack maxW="3xl" mx="auto" px={{ base: "lg", md: "3xl" }} py="2xl" gap="xl">
        <HStack justify="space-between" align="start">
          <Stack gap="xs">
            {doc.eyebrow ? (
              <Text textStyle="label/XS" color="fg.muted">
                {doc.eyebrow}
              </Text>
            ) : null}
            <HStack align="center" gap="md">
              <WorkbenchIcon name={doc.icon} size={32} color="fg.muted" />
              <Text as="h1" textStyle="display/XL/semibold">
                {doc.title}
              </Text>
            </HStack>
          </Stack>
          <IconButton
            aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
            variant="ghost"
            size="sm"
            onClick={() =>
              store.setState({
                favoriteIds: favorite
                  ? state.favoriteIds.filter((id) => id !== doc.id)
                  : [...state.favoriteIds, doc.id],
              })
            }
          >
            <WorkbenchIcon name="Star" color={favorite ? "fg.warning" : "fg.muted"} />
          </IconButton>
        </HStack>
        <MarkdownEditor
          key={doc.id}
          defaultState={state.contentById[doc.id] ?? documentMarkdown(doc)}
          fullWidth
          isEditable
          padding="0"
          scrollable={false}
          onChange={(content) =>
            store.setState((current) => ({ ...current, contentById: { ...current.contentById, [doc.id]: content } }))
          }
        />
      </Stack>
    </ScrollArea>
  );
};

export const createScribbleWorkbench = () => {
  const store = createShowcaseStore<ScribbleState>({
    documents: scribbleDocuments,
    favoriteIds: ["north-star"],
    contentById: Object.fromEntries(scribbleDocuments.map((document) => [document.id, documentMarkdown(document)])),
  });
  const workbench = createWorkbench({ startPage: homePage });
  workbench.themes.register([scribbleTheme]);
  workbench.modes.registerMode({
    id: "scribble",
    label: "Scribble",
    resourceKinds: ["scribble.document"],
    chrome: { sidenav: "scribble.tree", activity: false, status: "scribble.sync" },
    regionSettings: { sidenav: { size: { defaultPx: 240, minPx: 200, maxPx: 320 }, collapsible: false } },
    activate: () => undefined,
  });
  workbench.commands.registerCommand(
    { id: "scribble.createPage", label: "New page", icon: "FilePlus" },
    {
      execute() {
        const document: ScribbleDocument = {
          id: crypto.randomUUID(),
          title: "Untitled page",
          icon: "FileText",
          eyebrow: "",
          intro: "",
          sections: [],
          tasks: [],
        };
        const state = store.getState();
        store.setState({
          documents: [...state.documents, document],
          contentById: { ...state.contentById, [document.id]: "" },
        });
        workbench.views.refreshView("scribble.tree");
        workbench.pageLocations.navigate({ kind: "page", page, resource: resource(document), open: "preview" });
      },
    },
  );
  workbench.views.registerView({
    id: "scribble.tree",
    title: "Pages",
    body: {
      kind: "tree",
      getChildren: () => [],
      searchable: true,
      searchPlaceholder: "Search pages",
      getBody(ctx) {
        const state = store.getState();
        const words = ctx.filter?.trim().toLowerCase().split(/\s+/) ?? [];
        const documents = state.documents.filter((document) =>
          words.every((word) => `${document.title} ${state.contentById[document.id]}`.toLowerCase().includes(word)),
        );
        return [
          {
            id: "workspace",
            label: "Workspace",
            collapsible: false,
            nodes: documents.map((document) => ({
              id: document.id,
              label: document.title,
              icon: document.icon,
              canDrag: true,
              canDrop: true,
              resource: resource(document),
              target: { kind: "page" as const, page, resource: resource(document), open: "pin" as const },
            })),
          },
        ];
      },
      getFooter: () => [
        {
          id: "actions",
          nodes: [
            {
              id: "new-page",
              label: "New page",
              icon: "Plus",
              target: { kind: "command", commandId: "scribble.createPage" },
            },
          ],
        },
      ],
      moveNode(source, target, ctx) {
        const documents = [...store.getState().documents];
        const [document] = documents.splice(
          documents.findIndex((item) => item.id === source.id),
          1,
        );
        const index = target ? documents.findIndex((item) => item.id === target.id) : documents.length;
        documents.splice(index + Number(ctx.position === "after"), 0, document!);
        store.setState({ documents });
        ctx.refresh();
      },
    },
  });
  workbench.views.registerView({
    id: "scribble.document",
    title: "Document",
    body: { kind: "react", render: (input) => <DocumentCanvas input={input} store={store} /> },
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
  workbench.modePlacements.registerPlacement({
    id: viewer.id,
    ref: viewer,
    modeId: "scribble",
    region: "main",
    addableIn: ["main"],
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", id: "scribble.document" }],
        view: { kind: "view", id: "scribble.document" },
        cardinality: "many",
        add: { kind: "command", target: { command: { kind: "command", id: "scribble.createPage" } } },
      },
    },
    tab: {
      getSnapshot(instance) {
        const document = store.getState().documents.find((item) => item.id === instance.resource?.id);
        return { label: document?.title, icon: document?.icon };
      },
    },
  });
  workbench.pages.registerPage({
    id: "scribble.home",
    ref: homePage,
    title: "Scribble",
    path: "scribble",
    modeId: "scribble",
    main: { kind: "panels" },
    panelView: viewer,
    slots: [],
  });
  workbench.pages.registerPage({
    id: "scribble.resource",
    ref: page,
    title: "Page",
    path: "scribble/resource",
    modeId: "scribble",
    parentId: "scribble.home",
    resource: { kinds: [{ kind: "resource-kind", id: "scribble.document" }] },
    main: { kind: "panels", landing: viewer },
    slots: [],
  });
  workbench.pageLocations.switchProject("storybook-scribble");
  workbench.pageLocations.navigate({ kind: "page", page, resource: resource(scribbleDocuments[0]), open: "pin" });
  return workbench;
};
