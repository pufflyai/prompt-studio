import { Box, Stack, Text } from "@chakra-ui/react";
import { ListRow, SessionIndicator } from "@pstdio/ui";
import type { RecentProjectResource } from "../recent-resources";
import { HomeIcon as WorkbenchIcon } from "./home-icon";

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
            role="button"
            key={resource.id}
            id={resource.id}
            label={resource.title}
            tooltip={resource.title}
            icon={
              resource.resource.type === "session" ? (
                <SessionIndicator
                  status={resource.status}
                  ariaLabel={resource.status ? `Session status: ${resource.status}` : "Session status"}
                />
              ) : (
                <WorkbenchIcon name={resource.icon} size={14} />
              )
            }
            onActivate={() => onOpen(resource)}
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
