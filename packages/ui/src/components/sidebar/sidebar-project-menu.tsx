import { Avatar, Button, HStack, Icon, Menu, Portal, Text } from "@chakra-ui/react";
import { ChevronDown, FolderIcon } from "lucide-react";
import { ListRow } from "../list-row/list-row";

interface SidebarProjectMenuProps {
  name: string;
  projectsLabel: string;
  onSelectProjects: () => void;
}

export const SidebarProjectMenu = (props: SidebarProjectMenuProps) => {
  const { name, projectsLabel, onSelectProjects } = props;

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button borderRadius="0" variant="ghost" size="sm" width="full" justifyContent="flex-start">
          <HStack gap="0" minW="0" flex="1">
            <Avatar.Root size="2xs">
              <Avatar.Fallback name={name} />
            </Avatar.Root>
            <Text textStyle="label/S/medium" truncate>
              {name}
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
                label={projectsLabel}
                icon={<Icon as={FolderIcon} boxSize="16px" />}
                onActivate={onSelectProjects}
              />
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};
