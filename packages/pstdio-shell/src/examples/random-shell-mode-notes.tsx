import { Badge, HStack, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type { Disposable, ShellModeActivationContext, TreeNode } from "../core";
import { ShellIcon, type ShellWidgetRenderInput } from "../react";
import { itemResource, notesWidgetIds, randomResourceKind, randomShellModes } from "./random-shell-example-data";

const notesMode = randomShellModes.notes;
const notesTreeViewId = "notes.navigation";

const findItemFromLayout = (input: ShellWidgetRenderInput) => {
  const editorPlacement = input.shell.layout.getLayout().areas.main.widgets[0];
  const itemId =
    typeof editorPlacement?.resource?.metadata?.itemId === "string"
      ? editorPlacement.resource.metadata.itemId
      : undefined;
  return (
    notesMode.items.find((item) => item.id === itemId) ??
    notesMode.items.find((item) => item.id === notesMode.defaultItemId) ??
    notesMode.items[0]
  );
};

const buildNotesTreeSections = () =>
  notesMode.folders.map((folder) => ({
    id: folder.id,
    label: folder.label,
    nodes: folder.itemIds.flatMap((itemId): TreeNode[] => {
      const item = notesMode.items.find((candidate) => candidate.id === itemId);
      if (!item) return [];
      const resource = itemResource(notesMode.id, item);
      return [
        {
          id: resource.uri,
          label: item.title,
          icon: "FileText",
          resource,
        },
      ];
    }),
  }));

const NotesTopBar = (props: { input: ShellWidgetRenderInput }) => {
  const { input } = props;
  const item = findItemFromLayout(input);
  return (
    <HStack h="full" px="sm" gap="sm">
      <ShellIcon name={notesMode.topIcon} size={18} />
      <HStack flex="1" minW="0" gap="xs">
        <Text textStyle="label/S/medium" color="fg" flexShrink={0}>
          {notesMode.label}
        </Text>
        <Text textStyle="label/XS/regular" color="fg.muted" truncate>
          {notesMode.topSubtitle} · {item.title}
        </Text>
      </HStack>
      <Badge colorPalette="gray" variant="outline" size="sm">
        Notebook
      </Badge>
    </HStack>
  );
};

const NotesEditor = (props: { input: ShellWidgetRenderInput }) => {
  const item = findItemFromLayout(props.input);
  return (
    <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
      <Stack gap="md" w="full">
        <Stack gap="2xs">
          <Text textStyle="heading/L" color="fg">
            {item.title}
          </Text>
          <Text textStyle="label/XS/regular" color="fg.muted">
            {item.subtitle}
          </Text>
        </Stack>
        {item.sections.map((section) => (
          <Stack key={section.heading} gap="xs">
            <Text textStyle="label/S/medium" color="fg">
              {section.heading}
            </Text>
            <Stack gap="2xs" pl="sm">
              {section.lines.map((line) => (
                <Text key={line} textStyle="paragraph/S/regular" color="fg">
                  {line}
                </Text>
              ))}
            </Stack>
          </Stack>
        ))}
      </Stack>
    </ScrollArea>
  );
};

const NotesRelated = () => (
  <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
    <Stack gap="sm" w="full">
      <Text textStyle="label/S/medium" color="fg">
        {notesMode.relatedTitle}
      </Text>
      <Stack gap="xs">
        {notesMode.related.map((entry) => (
          <HStack key={entry.label} gap="xs" minW="0">
            <ShellIcon name={entry.icon} size={14} color="fg.muted" />
            <Stack gap="0" flex="1" minW="0">
              <Text textStyle="paragraph/S/medium" color="fg" truncate>
                {entry.label}
              </Text>
              <Text textStyle="label/XS/regular" color="fg.muted" truncate>
                {entry.hint}
              </Text>
            </Stack>
          </HStack>
        ))}
      </Stack>
    </Stack>
  </ScrollArea>
);

const NotesStatus = () => (
  <HStack h="full" px="sm" gap="md">
    <ShellIcon name={notesMode.statusIcon} size={12} color="fg.muted" />
    <Text textStyle="label/XS/medium" color="fg">
      {notesMode.statusText}
    </Text>
  </HStack>
);

const NotesHelper = () => (
  <ScrollArea h="full" contentProps={{ p: "md" }}>
    <Stack gap="xs" w="full">
      <HStack gap="xs">
        <ShellIcon name={notesMode.helperIcon} size={16} />
        <Text textStyle="label/S/medium" color="fg">
          {notesMode.helperTitle}
        </Text>
      </HStack>
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        {notesMode.helperBody}
      </Text>
    </Stack>
  </ScrollArea>
);

interface WidgetSetup {
  id: string;
  title: string;
  area: "top" | "main" | "main-right" | "status" | "floating";
  render: (input: ShellWidgetRenderInput) => React.ReactNode;
}

const notesWidgets: WidgetSetup[] = [
  { id: notesWidgetIds.top, title: "Notes header", area: "top", render: (input) => <NotesTopBar input={input} /> },
  { id: notesWidgetIds.editor, title: "Note editor", area: "main", render: (input) => <NotesEditor input={input} /> },
  { id: notesWidgetIds.related, title: "Linked notes", area: "main-right", render: () => <NotesRelated /> },
  { id: notesWidgetIds.status, title: "Sync status", area: "status", render: () => <NotesStatus /> },
  { id: notesWidgetIds.helper, title: "Note helper", area: "floating", render: () => <NotesHelper /> },
];

export const setupNotesMode = (ctx: ShellModeActivationContext): Disposable[] => {
  const disposables: Disposable[] = [];

  for (const widget of notesWidgets) {
    disposables.push(
      ctx.renderers.registerRenderer({ id: widget.id, render: widget.render }),
      ctx.layout.registerWidget({
        id: widget.id,
        title: widget.title,
        area: widget.area,
        singleton: true,
        renderer: "react",
        rendererId: widget.id,
      }),
    );
  }

  disposables.push(
    ctx.trees.registerTreeView({
      id: notesTreeViewId,
      title: notesMode.label,
      area: "main-left",
      getRoots: () => [],
      getSections: () => buildNotesTreeSections(),
      getChildren: () => [],
    }),
    ctx.resources.registerOpener({
      id: "notes.opener",
      canOpen: (resource) => resource.kind === randomResourceKind && resource.metadata?.modeId === notesMode.id,
      open: (resource, input) =>
        ctx.layout.openWidget(notesWidgetIds.editor, {
          resource,
          title: resource.label,
          replaceActive: input.replaceActive,
        }),
    }),
  );

  const defaultItem = notesMode.items.find((item) => item.id === notesMode.defaultItemId) ?? notesMode.items[0];
  ctx.layout.openWidget(notesWidgetIds.editor, {
    resource: itemResource(notesMode.id, defaultItem),
    title: defaultItem.title,
    closable: false,
  });
  for (const widget of notesWidgets) {
    if (widget.id === notesWidgetIds.editor) continue;
    ctx.layout.openWidget(widget.id, { pinned: true, closable: false });
  }

  return disposables;
};
