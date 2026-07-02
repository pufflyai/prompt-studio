import { Badge, Box, HStack, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { WorkbenchIcon, type WorkbenchWidgetRenderInput } from "../../../react";
import { workbenchModes, workspaceFiles } from "../mock-data/data";

const findActiveFile = (input: WorkbenchWidgetRenderInput) => {
  const placement = input.workbench.layout.getLayout().areas.main.widgets[0];
  const fileId = typeof placement?.resource?.metadata?.fileId === "string" ? placement.resource.metadata.fileId : null;
  return workspaceFiles.find((file) => file.id === fileId) ?? workspaceFiles[0];
};

export const WorkspaceEditor = (props: { input: WorkbenchWidgetRenderInput }) => {
  const file = findActiveFile(props.input);

  return (
    <Stack h="full" minH="0" gap="0">
      <HStack
        flexShrink={0}
        h="2.25rem"
        px="sm"
        borderBottomWidth="1px"
        borderColor="border.subtle"
        bg="bg.subtle"
        gap="xs"
      >
        <WorkbenchIcon name="FileCode" size={14} color="fg.muted" />
        <Text textStyle="label/S/medium" color="fg">
          {file.label}
        </Text>
        <Badge variant="outline" size="sm" colorPalette="gray">
          {file.language}
        </Badge>
      </HStack>
      <ScrollArea flex="1" minH="0" contentProps={{ p: "md" }}>
        <Stack gap="0" fontFamily="mono" w="full">
          {file.body.map((line, index) => (
            <HStack key={`${file.id}-${index}`} gap="md" minH="1.25rem">
              <Text
                textStyle="label/XS/regular"
                color="fg.muted"
                w="2rem"
                textAlign="right"
                flexShrink={0}
                fontFamily="mono"
              >
                {index + 1}
              </Text>
              <Text textStyle="paragraph/S/regular" color="fg" fontFamily="mono" whiteSpace="pre">
                {line}
              </Text>
            </HStack>
          ))}
        </Stack>
      </ScrollArea>
    </Stack>
  );
};

export const WorkspaceDiff = (props: { input: WorkbenchWidgetRenderInput }) => {
  const file = findActiveFile(props.input);

  return (
    <ScrollArea h="full" minH="0" contentProps={{ p: "md" }}>
      <Stack gap="sm" w="full">
        <HStack gap="xs">
          <WorkbenchIcon name="GitCompare" size={14} color="fg.muted" />
          <Text textStyle="label/S/medium" color="fg">
            Diff preview
          </Text>
        </HStack>
        <Stack gap="2xs">
          {file.diff.removed.map((line, index) => (
            <Box key={`r-${index}`} colorPalette="red" bg="colorPalette.subtle" borderRadius="xs" px="xs" py="2xs">
              <Text textStyle="paragraph/S/regular" color="colorPalette.fg" fontFamily="mono">
                {line}
              </Text>
            </Box>
          ))}
          {file.diff.added.map((line, index) => (
            <Box key={`a-${index}`} colorPalette="green" bg="colorPalette.subtle" borderRadius="xs" px="xs" py="2xs">
              <Text textStyle="paragraph/S/regular" color="colorPalette.fg" fontFamily="mono">
                {line}
              </Text>
            </Box>
          ))}
          {file.diff.removed.length === 0 && file.diff.added.length === 0 ? (
            <Text textStyle="paragraph/S/regular" color="fg.muted">
              No changes
            </Text>
          ) : null}
        </Stack>
      </Stack>
    </ScrollArea>
  );
};

export const WorkspaceMainHeader = () => (
  <HStack h="full" px="sm" gap="sm">
    <WorkbenchIcon name={workbenchModes.workspace.icon} size={16} />
    <Text textStyle="label/S/medium" color="fg">
      Workspace mode
    </Text>
    <Text textStyle="label/XS/regular" color="fg.muted" truncate>
      {workbenchModes.workspace.description}
    </Text>
  </HStack>
);
