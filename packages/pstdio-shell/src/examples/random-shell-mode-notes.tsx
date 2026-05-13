import { Badge, Box, HStack, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type { Disposable, ShellModeActivationContext } from "../core";
import { ShellIcon, type ShellWidgetRenderInput } from "../react";
import { itemResource, notesWidgetIds, randomShellModes, type ShellModeItem } from "./random-shell-example-data";

const notesMode = randomShellModes.notes;

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

const openNote = (input: ShellWidgetRenderInput, item: ShellModeItem) => {
  input.shell.layout.openWidget(notesWidgetIds.editor, {
    resource: itemResource(notesMode.id, item),
    title: item.title,
  });
  input.refresh();
};

const NotesTopBar = (props: { input: ShellWidgetRenderInput }) => {
  const { input } = props;
  const item = findItemFromLayout(input);
  return (
    <HStack h="full" px="sm" gap="sm">
      <ShellIcon name={notesMode.topIcon} size={18} />
      <Stack gap="0" flex="1" minW="0">
        <Text textStyle="label/S/medium" color="fg" truncate>
          {notesMode.label}
        </Text>
        <Text textStyle="label/XS/regular" color="fg.muted" truncate>
          {notesMode.topSubtitle} · {item.title}
        </Text>
      </Stack>
      <Badge colorPalette="gray" variant="outline" size="sm">
        Notebook
      </Badge>
    </HStack>
  );
};

const NotesTree = (props: { input: ShellWidgetRenderInput }) => {
  const { input } = props;
  const activeItem = findItemFromLayout(input);

  return (
    <ScrollArea h="full" minH="0" contentProps={{ p: "xs" }}>
      <Stack gap="sm" w="full">
        {notesMode.folders.map((folder) => (
          <Stack key={folder.id} gap="2xs">
            <HStack gap="xs" px="xs">
              <ShellIcon name={folder.icon} size={14} color="fg.muted" />
              <Text textStyle="label/XS/medium" color="fg.muted" truncate>
                {folder.label}
              </Text>
            </HStack>
            <Stack gap="0">
              {folder.itemIds.map((itemId) => {
                const item = notesMode.items.find((candidate) => candidate.id === itemId);
                if (!item) return null;
                const selected = item.id === activeItem.id;
                return (
                  <Box
                    key={item.id}
                    as="button"
                    onClick={() => openNote(input, item)}
                    textAlign="left"
                    borderRadius="sm"
                    bg={selected ? "bg.emphasized" : "transparent"}
                    _hover={{ bg: selected ? "bg.emphasized" : "bg.muted" }}
                    px="sm"
                    py="2xs"
                    minW="0"
                  >
                    <HStack gap="xs" minW="0">
                      <ShellIcon name="FileText" size={12} color="fg.muted" />
                      <Text textStyle="paragraph/S/regular" color="fg" truncate>
                        {item.title}
                      </Text>
                    </HStack>
                  </Box>
                );
              })}
            </Stack>
          </Stack>
        ))}
      </Stack>
    </ScrollArea>
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
  area: "top" | "main-left" | "main" | "main-right" | "status" | "floating";
  render: (input: ShellWidgetRenderInput) => React.ReactNode;
}

const notesWidgets: WidgetSetup[] = [
  { id: notesWidgetIds.top, title: "Notes header", area: "top", render: (input) => <NotesTopBar input={input} /> },
  {
    id: notesWidgetIds.tree,
    title: "Notebook tree",
    area: "main-left",
    render: (input) => <NotesTree input={input} />,
  },
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
