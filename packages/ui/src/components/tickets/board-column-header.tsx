import { Badge, HStack, Icon, IconButton, Menu, Spacer, Text } from "@chakra-ui/react";
import { MoreHorizontal, Plus } from "lucide-react";

import { MenuItem } from "@/components/menu-item";
import { Tooltip } from "@/components/tooltip";

import { getIconComponent } from "./tag-icons";
import type { TicketBoardColumn } from "./ticket-board";

interface BoardColumnHeaderProps {
  column: TicketBoardColumn;
  onCreateStart?: (columnId: string) => void;
  onColumnAction?: (columnId: string, actionId: string) => Promise<void> | void;
}

export const BoardColumnHeader = (props: BoardColumnHeaderProps) => {
  const { column, onCreateStart, onColumnAction } = props;

  return (
    <HStack padding="xs" gap="xs" alignItems="center">
      {column.icon && (
        <Icon as={getIconComponent(column.icon)} boxSize="14px" color={`${column.color ?? "gray"}.500`} />
      )}
      <Text textStyle="label/L/medium">{column.label}</Text>

      <Badge variant="subtle" colorPalette={column.color ?? "gray"}>
        {column.items.length}
      </Badge>

      <Spacer />

      {column.canCreate && onCreateStart && (
        <Tooltip content="Create new ticket">
          <IconButton size="2xs" variant="outline" onClick={() => onCreateStart(column.id)} aria-label="Create ticket">
            <Icon as={Plus} boxSize="12px" />
          </IconButton>
        </Tooltip>
      )}

      {column.actions.length > 0 && (
        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton size="2xs" variant="ghost" aria-label={`Column actions for ${column.label}`}>
              <Icon as={MoreHorizontal} boxSize="12px" />
            </IconButton>
          </Menu.Trigger>
          <Menu.Positioner>
            <Menu.Content minW="180px" bg="bg">
              {column.actions.map((action) => (
                <MenuItem
                  key={action.id}
                  primaryLabel={action.label}
                  leftIcon={action.icon}
                  onClick={() => onColumnAction?.(column.id, action.id)}
                />
              ))}
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Root>
      )}
    </HStack>
  );
};
