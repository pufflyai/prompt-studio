import { Badge, HStack, Icon, IconButton, Menu, Spacer, Text } from "@chakra-ui/react";
import { MoreHorizontal, Plus } from "lucide-react";

import { ListRow } from "@/components/list-row/list-row";
import { getIconComponent } from "@/components/primitives/icon-color-picker";
import { Tooltip } from "@/components/primitives/tooltip";
import type { KanbanRendererBoardColumn } from "./kanban-renderer-board";

interface ColumnHeaderProps {
  column: KanbanRendererBoardColumn;
  onCreateStart?: (columnId: string) => void;
  onColumnAction?: (columnId: string, actionId: string) => Promise<void> | void;
}

export const ColumnHeader = (props: ColumnHeaderProps) => {
  const { column, onCreateStart, onColumnAction } = props;

  return (
    <HStack minH="1.5rem" gap="2xs" alignItems="center" colorPalette={column.color ?? "gray"}>
      <Icon
        data-testid="column-status-icon"
        as={getIconComponent(column.icon)}
        boxSize="0.875rem"
        color="colorPalette.solid"
        flexShrink={0}
      />
      <Text textStyle="label/S/medium">{column.label}</Text>

      <Badge variant="number" size="xs" colorPalette="gray">
        {column.items.length}
      </Badge>

      <Spacer />

      {column.canCreate && onCreateStart && (
        <Tooltip content={column.createLabel ?? "Create new row"}>
          <IconButton
            size="2xs"
            variant="outline"
            onClick={() => onCreateStart(column.id)}
            aria-label={column.createLabel ?? "Create row"}
          >
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
                <Menu.Item key={action.id} value={action.id} asChild>
                  <ListRow
                    asChild
                    variant="full-width"
                    label={action.label}
                    icon={<Icon as={action.icon} boxSize="16px" />}
                    onActivate={() => onColumnAction?.(column.id, action.id)}
                  />
                </Menu.Item>
              ))}
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Root>
      )}
    </HStack>
  );
};
