import { Avatar, Button, HStack, Menu, Text } from "@chakra-ui/react";
import { ChevronDown, FolderIcon, Moon, Sun } from "lucide-react";
import { MenuItem } from "../menu-item";

interface SidebarProjectMenuProps {
  name: string;
  projectsLabel: string;
  themeModeLabel: string;
  isDarkMode: boolean;
  onSelectProjects: () => void;
  onToggleThemePreference: () => void;
}

export const SidebarProjectMenu = (props: SidebarProjectMenuProps) => {
  const { name, projectsLabel, themeModeLabel, isDarkMode, onSelectProjects, onToggleThemePreference } = props;

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button variant="ghost" size="sm" width="full" justifyContent="flex-start">
          <HStack gap="2" minW="0" flex="1">
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
      <Menu.Positioner>
        <Menu.Content minW="240px" bg="bg">
          <MenuItem onClick={onSelectProjects} primaryLabel={projectsLabel} leftIcon={FolderIcon} />
          <Menu.Separator />
          <MenuItem
            onClick={onToggleThemePreference}
            primaryLabel={themeModeLabel}
            leftIcon={isDarkMode ? Sun : Moon}
          />
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};
