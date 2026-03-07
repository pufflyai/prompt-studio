import { Badge, HStack, Icon, IconButton, Menu, Spacer, Stack, Text } from "@chakra-ui/react";
import { MoreHorizontal, Plus } from "lucide-react";
import { type ComponentProps, type ComponentType, type DragEvent, useState } from "react";

import { MenuItem } from "@/components/menu-item";
import { Tooltip } from "@/components/tooltip";

import { TicketCard } from "./ticket-card";

type TicketCardProps = ComponentProps<typeof TicketCard>;

export interface TicketBoardItem {
  id: string;
  cardProps: Omit<TicketCardProps, "draggable" | "onDragStart" | "onDragEnd" | "isSelected">;
}

export interface TicketBoardColumnAction {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number | string }>;
}

export interface TicketBoardColumn {
  id: string;
  label: string;
  color?: string;
  items: TicketBoardItem[];
  canDragIn: boolean;
  canDragOut: boolean;
  canCreate: boolean;
  actions: TicketBoardColumnAction[];
}

interface TicketBoardProps {
  columns: TicketBoardColumn[];
  selectedItemId?: string | null;
  onMoveItem?: (itemId: string, targetColumnId: string) => void;
  onCreateStart?: (columnId: string) => void;
  onColumnAction?: (columnId: string, actionId: string) => Promise<void> | void;
}

export const TicketBoard = (props: TicketBoardProps) => {
  const { columns, selectedItemId = null, onMoveItem, onCreateStart, onColumnAction } = props;

  const [activeColumn, setActiveColumn] = useState<string | null>(null);

  const handleDragStart = (itemId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData("text/plain", itemId);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setActiveColumn(null);
  };

  const handleDragOver = (columnId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setActiveColumn(columnId);
  };

  const handleDrop = (columnId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setActiveColumn(null);

    const itemId = event.dataTransfer.getData("text/plain");
    if (!itemId) return;

    onMoveItem?.(itemId, columnId);
  };

  return (
    <Stack
      height="100%"
      direction="row"
      gap="2xs"
      align="stretch"
      overflowX="auto"
      overflowY="hidden"
      paddingBottom="2xs"
    >
      {columns.map((column) => (
        <Stack
          key={column.id}
          gap="xs"
          padding="xs"
          _notFirst={{ borderLeft: "1px solid", borderColor: "border" }}
          background={activeColumn === column.id ? "background.secondary" : "background.primary"}
          height="100%"
          minH="240px"
          overflow="hidden"
          minW="260px"
          flex="1 0 260px"
          onDragOver={column.canDragIn ? handleDragOver(column.id) : undefined}
          onDrop={column.canDragIn ? handleDrop(column.id) : undefined}
        >
          <ColumnHeader column={column} onCreateStart={onCreateStart} onColumnAction={onColumnAction} />

          <Stack gap="sm" flex="1" minH="0" overflowY="auto">
            {column.items.map((item) => (
              <TicketCard
                key={item.id}
                {...item.cardProps}
                isSelected={item.id === selectedItemId}
                draggable={column.canDragOut}
                onDragStart={column.canDragOut ? handleDragStart(item.id) : undefined}
                onDragEnd={column.canDragOut ? handleDragEnd : undefined}
              />
            ))}
          </Stack>
        </Stack>
      ))}
    </Stack>
  );
};

interface ColumnHeaderProps {
  column: TicketBoardColumn;
  onCreateStart?: (columnId: string) => void;
  onColumnAction?: (columnId: string, actionId: string) => Promise<void> | void;
}

const ColumnHeader = (props: ColumnHeaderProps) => {
  const { column, onCreateStart, onColumnAction } = props;

  return (
    <HStack gap="xs" alignItems="center">
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
            <Menu.Content minW="180px" bg="background.primary">
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
