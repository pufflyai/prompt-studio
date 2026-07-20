import { Badge, HStack, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { WorkbenchIcon, type WorkbenchWidgetRenderInput } from "../../../react";
import { randomWorkbenchModes } from "../mock-data/data";

const notesMode = randomWorkbenchModes.notes;

const findItemFromLayout = (input: WorkbenchWidgetRenderInput) => {
  const editorPlacement = input.workbench.layout.getLayout().regions.main.widgets[0];
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

export const NotesTopBar = (props: { input: WorkbenchWidgetRenderInput }) => {
  const item = findItemFromLayout(props.input);
  return (
    <HStack h="full" px="sm" gap="sm">
      <WorkbenchIcon name={notesMode.topIcon} size={18} />
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

export const NotesEditor = (props: { input: WorkbenchWidgetRenderInput }) => {
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

export const NotesRelated = () => (
  <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
    <Stack gap="sm" w="full">
      <Text textStyle="label/S/medium" color="fg">
        {notesMode.relatedTitle}
      </Text>
      <Stack gap="xs">
        {notesMode.related.map((entry) => (
          <HStack key={entry.label} gap="xs" minW="0">
            <WorkbenchIcon name={entry.icon} size={14} color="fg.muted" />
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

export const NotesStatus = () => (
  <HStack h="full" px="sm" gap="md">
    <WorkbenchIcon name={notesMode.statusIcon} size={12} color="fg.muted" />
    <Text textStyle="label/XS/medium" color="fg">
      {notesMode.statusText}
    </Text>
  </HStack>
);

export const NotesHelper = () => (
  <ScrollArea h="full" contentProps={{ p: "md" }}>
    <Stack gap="xs" w="full">
      <HStack gap="xs">
        <WorkbenchIcon name={notesMode.helperIcon} size={16} />
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
