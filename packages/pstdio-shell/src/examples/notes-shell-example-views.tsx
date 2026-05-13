import { Badge, Box, Button, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { createShellRendererRegistry, ShellIcon, type ShellWidgetRenderInput } from "../react";
import {
  defaultShellModeId,
  itemResource,
  notesModeContextKey,
  notesWidgetIds,
  railEntries,
  type ShellMode,
  type ShellModeItem,
  shellModes,
} from "./notes-shell-example-data";

interface ViewConfig {
  openCommandPalette: () => void;
}

const getActiveModeId = (input: ShellWidgetRenderInput) => {
  const stored = input.shell.context.get(notesModeContextKey);
  return typeof stored === "string" && stored in shellModes ? stored : defaultShellModeId;
};

const getActiveMode = (input: ShellWidgetRenderInput) => shellModes[getActiveModeId(input)];

const findItem = (mode: ShellMode, itemId: string | undefined) =>
  mode.items.find((item) => item.id === itemId) ?? mode.items.find((item) => item.id === mode.defaultItemId);

const getActiveItem = (input: ShellWidgetRenderInput) => {
  const mode = getActiveMode(input);
  const editorPlacement = input.shell.layout.getLayout().areas.main.widgets[0];
  const itemId =
    typeof editorPlacement?.resource?.metadata?.itemId === "string"
      ? editorPlacement.resource.metadata.itemId
      : undefined;
  return findItem(mode, itemId) ?? mode.items[0];
};

const openItem = (input: ShellWidgetRenderInput, mode: ShellMode, item: ShellModeItem) => {
  const resource = itemResource(mode.id, item);
  input.shell.layout.openWidget(notesWidgetIds.editor, { resource, title: item.title });
  input.refresh();
};

const switchMode = (input: ShellWidgetRenderInput, modeId: string) => {
  input.shell.context.set(notesModeContextKey, modeId);
  const mode = shellModes[modeId];
  const defaultItem = mode.items.find((item) => item.id === mode.defaultItemId) ?? mode.items[0];
  openItem(input, mode, defaultItem);
};

const createTopBar = (config: ViewConfig) => (input: ShellWidgetRenderInput) => {
  const mode = getActiveMode(input);

  return (
    <HStack h="full" px="sm" gap="sm">
      <HStack gap="xs" flex="1" minW="0">
        <ShellIcon name={mode.topIcon} size={18} />
        <Text textStyle="label/S/medium" color="fg">
          {mode.label}
        </Text>
        <Text textStyle="label/XS/regular" color="fg.muted" truncate>
          {mode.topSubtitle}
        </Text>
      </HStack>
      <Button size="xs" variant="subtle" onClick={config.openCommandPalette}>
        <ShellIcon name="Command" size={14} />
        Command palette
        <Badge ml="2xs" colorPalette="gray" variant="outline">
          ⌘K
        </Badge>
      </Button>
    </HStack>
  );
};

const ActivityRail = (props: { input: ShellWidgetRenderInput }) => {
  const { input } = props;
  const activeModeId = getActiveModeId(input);

  return (
    <Stack h="full" alignItems="center" py="sm" gap="sm">
      {railEntries.map((entry) => {
        const selected = entry.id === activeModeId;
        return (
          <IconButton
            key={entry.id}
            aria-label={entry.label}
            size="sm"
            variant={selected ? "subtle" : "ghost"}
            onClick={() => switchMode(input, entry.id)}
          >
            <ShellIcon name={entry.icon} size={18} />
          </IconButton>
        );
      })}
    </Stack>
  );
};

const Header = (props: { input: ShellWidgetRenderInput }) => {
  const { input } = props;
  const mode = getActiveMode(input);
  const item = getActiveItem(input);

  return (
    <HStack h="full" px="sm" gap="sm">
      <Stack gap="0" flex="1" minW="0">
        <Text textStyle="label/M/medium" color="fg" truncate>
          {item.title}
        </Text>
        <Text textStyle="label/XS/regular" color="fg.muted" truncate>
          {item.subtitle}
        </Text>
      </Stack>
      {mode.actions.map((action) => (
        <Button key={action.id} size="xs" variant="ghost">
          <ShellIcon name={action.icon} size={14} />
          {action.label}
        </Button>
      ))}
    </HStack>
  );
};

const Tree = (props: { input: ShellWidgetRenderInput }) => {
  const { input } = props;
  const mode = getActiveMode(input);
  const activeItem = getActiveItem(input);

  return (
    <ScrollArea h="full" minH="0" contentProps={{ p: "xs" }}>
      <Stack gap="sm" w="full">
        {mode.folders.map((folder) => (
          <Stack key={folder.id} gap="2xs">
            <HStack gap="xs" px="xs">
              <ShellIcon name={folder.icon} size={14} color="fg.muted" />
              <Text textStyle="label/XS/medium" color="fg.muted" truncate>
                {folder.label}
              </Text>
            </HStack>
            <Stack gap="0">
              {folder.itemIds.map((itemId) => {
                const item = mode.items.find((candidate) => candidate.id === itemId);
                if (!item) return null;
                const selected = item.id === activeItem.id;
                return (
                  <Box
                    key={item.id}
                    as="button"
                    onClick={() => openItem(input, mode, item)}
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

const Editor = (props: { input: ShellWidgetRenderInput }) => {
  const { input } = props;
  const item = getActiveItem(input);

  return (
    <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
      <Stack gap="md" w="full">
        <Text textStyle="heading/L" color="fg">
          {item.title}
        </Text>
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

const Details = (props: { input: ShellWidgetRenderInput }) => {
  const { input } = props;
  const mode = getActiveMode(input);

  return (
    <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
      <Stack gap="sm" w="full">
        <Text textStyle="label/S/medium" color="fg">
          {mode.relatedTitle}
        </Text>
        <Stack gap="xs">
          {mode.related.map((entry) => (
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
};

const StatusBar = (props: { input: ShellWidgetRenderInput }) => {
  const { input } = props;
  const mode = getActiveMode(input);

  return (
    <HStack h="full" px="sm" gap="md">
      <HStack gap="xs">
        <ShellIcon name={mode.statusIcon} size={12} color="fg.muted" />
        <Text textStyle="label/XS/medium" color="fg">
          {mode.statusText}
        </Text>
      </HStack>
    </HStack>
  );
};

const Helper = (props: { input: ShellWidgetRenderInput }) => {
  const { input } = props;
  const mode = getActiveMode(input);

  return (
    <ScrollArea h="full" contentProps={{ p: "md" }}>
      <Stack gap="xs" w="full">
        <HStack gap="xs">
          <ShellIcon name={mode.helperIcon} size={16} />
          <Text textStyle="label/S/medium" color="fg">
            {mode.helperTitle}
          </Text>
        </HStack>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {mode.helperBody}
        </Text>
      </Stack>
    </ScrollArea>
  );
};

export const createNotesRenderers = (config: ViewConfig) =>
  createShellRendererRegistry([
    { id: notesWidgetIds.top, render: createTopBar(config) },
    { id: notesWidgetIds.rail, render: (input) => <ActivityRail input={input} /> },
    { id: notesWidgetIds.header, render: (input) => <Header input={input} /> },
    { id: notesWidgetIds.tree, render: (input) => <Tree input={input} /> },
    { id: notesWidgetIds.editor, render: (input) => <Editor input={input} /> },
    { id: notesWidgetIds.details, render: (input) => <Details input={input} /> },
    { id: notesWidgetIds.status, render: (input) => <StatusBar input={input} /> },
    { id: notesWidgetIds.helper, render: (input) => <Helper input={input} /> },
  ]);
