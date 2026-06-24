import { Avatar, Button, HStack, IconButton, Text } from "@chakra-ui/react";
import { ChevronsUpDown } from "lucide-react";
import { Tooltip } from "../tooltip";

const projectButtonInteraction = {
  _hover: { bg: "bg.menu-item.hover" },
  _active: { bg: "bg.menu-item.selected" },
};

interface SidebarProjectMenuProps {
  name: string;
  // Activates the project (project mode home).
  onOpenProject: () => void;
  // Opens the project selector.
  onOpenProjectSelector: () => void;
}

export const SidebarProjectMenu = (props: SidebarProjectMenuProps) => {
  const { name, onOpenProject, onOpenProjectSelector } = props;

  return (
    <HStack gap="2xs" h="full" w="full" minW="0" px="2xs" alignItems="center">
      <Button
        px="xs"
        variant="ghost"
        size="sm"
        flex="1"
        minW="0"
        justifyContent="flex-start"
        onClick={onOpenProject}
        {...projectButtonInteraction}
      >
        <HStack gap="xs" minW="0" flex="1">
          <Avatar.Root size="2xs">
            <Avatar.Fallback name={name} background="bg.muted" color="fg.muted" />
          </Avatar.Root>
          <Text textStyle="label/S/medium" truncate>
            {name}
          </Text>
        </HStack>
      </Button>
      <Tooltip content="Switch project">
        <IconButton
          variant="ghost"
          size="sm"
          flexShrink={0}
          aria-label="Switch project"
          onClick={onOpenProjectSelector}
          {...projectButtonInteraction}
        >
          <ChevronsUpDown size={14} />
        </IconButton>
      </Tooltip>
    </HStack>
  );
};
