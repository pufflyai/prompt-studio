import { Avatar, Button, HStack, Menu, Portal, Text } from "@chakra-ui/react";
import { ListRow } from "@pstdio/ui";
import { ChevronDown } from "lucide-react";
import type { WorkbenchCore } from "../../../../../core";
import { WorkbenchIcon } from "../../../../../react";

export const DashboardLeftHeader = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button variant="ghost" size="sm" width="full" justifyContent="flex-start" px="xs">
          <HStack gap="xs" minW="0" flex="1">
            <Avatar.Root size="2xs" flexShrink={0}>
              <Avatar.Fallback name="Acme" />
            </Avatar.Root>
            <Text textStyle="label/M/medium" truncate>
              Acme
            </Text>
          </HStack>
          <ChevronDown size={14} />
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content minW="240px" bg="bg">
            <Menu.Item value="projects" asChild>
              <ListRow
                asChild
                variant="compact"
                id="projects"
                label="Projects"
                icon={<WorkbenchIcon name="FolderGit2" size={16} />}
                onActivate={() => workbench.notifications.show({ level: "info", title: "Project switcher opened" })}
              />
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
