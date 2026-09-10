import { Box, Stack, Text } from "@chakra-ui/react";
import { ListRow } from "@pstdio/ui";
import { WorkbenchIcon } from "@pstdio/workbench/react";
import type { RecentProjectResource } from "@/shared/recents/recent-project-resources";

interface StartRecentListProps {
  resources: RecentProjectResource[];
  onOpen: (resource: RecentProjectResource) => void;
}

export const StartRecentList = (props: StartRecentListProps) => {
  const { resources, onOpen } = props;

  return (
    <Stack gap="sm" minW="0">
      <Text textStyle="label/L/regular">Recent</Text>
      <Stack gap="none" minW="0">
        {resources.map((resource) => (
          <ListRow
            asChild
            role="button"
            tabIndex={0}
            key={resource.id}
            id={resource.id}
            label={resource.title}
            tooltip={resource.title}
            icon={<WorkbenchIcon name={resource.icon} size={14} />}
            endContent={
              <Text textStyle="label/XS" color="fg.muted">
                {resource.kindLabel}
              </Text>
            }
            onClick={() => onOpen(resource)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              onOpen(resource);
            }}
          />
        ))}
        {resources.length === 0 ? (
          <Box px="sm" py="md">
            <Text textStyle="label/S/regular" color="fg.muted">
              Nothing opened yet
            </Text>
          </Box>
        ) : null}
      </Stack>
    </Stack>
  );
};
