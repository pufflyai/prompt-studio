import { HStack, Stack, Text } from "@chakra-ui/react";
import { WorkbenchIcon } from "pstdio-workbench/react";
import { useProject } from "../hooks/use-project";

// Brand row for the `left-header` area — identifies the active project that
// scopes every resource, navigation target, and persisted layout.
export const ProjectHeader = (props: { projectId: string }) => {
  const project = useProject(props.projectId);

  return (
    <HStack gap="sm" px="sm" w="full" minW="0">
      <WorkbenchIcon name="FolderGit2" size={18} />
      <Stack gap="0" minW="0">
        <Text textStyle="label/M/semibold" truncate>
          {project?.name ?? "Loading project…"}
        </Text>
        <Text textStyle="label/S/regular" color="fg.muted" truncate>
          {project?.shorthand ?? props.projectId}
        </Text>
      </Stack>
    </HStack>
  );
};
