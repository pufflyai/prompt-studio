import { Badge, Box, HStack, Icon, IconButton, Menu, Spacer, Stack, Text } from "@chakra-ui/react";
import { ChevronRight, MoreHorizontal, Plus } from "lucide-react";
import { type ComponentProps, type ComponentType, type DragEvent, useState } from "react";

import { MenuItem } from "@/components/menu-item";
import { ScrollArea } from "@/components/scroll-area";
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

export interface TicketBoardGroup {
  key: string;
  label: string;
  items: TicketBoardItem[];
}

export interface TicketBoardColumn {
  id: string;
  label: string;
  color?: string;
  items: TicketBoardItem[];
  groups?: TicketBoardGroup[];
  canDragIn: boolean;
  canDragOut: boolean;
  canCreate: boolean;
  actions: TicketBoardColumnAction[];
}

interface TicketBoardProps {
  columns: TicketBoardColumn[];
  selectedItemId?: string | null;
  onMoveItem?: (itemId: string, targetColumnId: string) => void;
  onMoveToGroup?: (itemId: string, targetGroupKey: string) => void;
  onCreateStart?: (columnId: string) => void;
  onColumnAction?: (columnId: string, actionId: string) => Promise<void> | void;
}

export const TicketBoard = (props: TicketBoardProps) => {
  const { columns, selectedItemId = null, onMoveItem, onMoveToGroup, onCreateStart, onColumnAction } = props;

  const [activeColumn, setActiveColumn] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  const handleDragStart = (itemId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData("text/plain", itemId);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setActiveColumn(null);
    setActiveGroup(null);
  };

  const handleDragOver = (columnId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setActiveColumn(columnId);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    setActiveColumn(null);
  };

  const handleDrop = (columnId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setActiveColumn(null);

    const itemId = event.dataTransfer.getData("text/plain");
    if (!itemId) return;

    onMoveItem?.(itemId, columnId);
  };

  return (
    <ScrollArea
      height="100%"
      showHorizontalScrollbar
      showVerticalScrollbar={false}
      contentProps={{ display: "flex", alignItems: "stretch", gap: "0", pb: "2xs", minH: "100%" }}
    >
      {columns.map((column) => (
        <Stack
          key={column.id}
          data-testid={`board-column-${column.id}`}
          gap="xs"
          _notFirst={{ borderLeft: "1px solid", borderColor: "border" }}
          background={activeColumn === column.id ? "bg.subtle" : "bg"}
          transition="background 150ms ease"
          height="100%"
          minH="240px"
          overflow="hidden"
          minW="260px"
          flex="1 0 260px"
          onDragOver={column.canDragIn ? handleDragOver(column.id) : undefined}
          onDragLeave={column.canDragIn ? handleDragLeave : undefined}
          onDrop={column.canDragIn ? handleDrop(column.id) : undefined}
        >
          <ColumnHeader column={column} onCreateStart={onCreateStart} onColumnAction={onColumnAction} />

          <ScrollArea flex="1" minH="0" contentProps={{ spaceY: "sm" }}>
            {column.groups && column.groups.length > 0
              ? column.groups.map((group) => {
                  const groupId = `${column.id}::${group.key}`;
                  return (
                    <GroupSection
                      key={group.key}
                      group={group}
                      selectedItemId={selectedItemId}
                      canDragIn={column.canDragIn}
                      canDragOut={column.canDragOut}
                      isDropTarget={activeGroup === groupId}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onGroupDragOver={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        event.dataTransfer.dropEffect = "move";
                        setActiveGroup(groupId);
                        setActiveColumn(null);
                      }}
                      onGroupDragLeave={(event) => {
                        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
                        setActiveGroup(null);
                      }}
                      onGroupDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setActiveGroup(null);
                        setActiveColumn(null);
                        const itemId = event.dataTransfer.getData("text/plain");
                        if (!itemId) return;
                        onMoveItem?.(itemId, column.id);
                        onMoveToGroup?.(itemId, group.key);
                      }}
                    />
                  );
                })
              : column.items.map((item) => (
                  <TicketCard
                    key={item.id}
                    {...item.cardProps}
                    isSelected={item.id === selectedItemId}
                    draggable={column.canDragOut}
                    onDragStart={column.canDragOut ? handleDragStart(item.id) : undefined}
                    onDragEnd={column.canDragOut ? handleDragEnd : undefined}
                  />
                ))}
          </ScrollArea>
        </Stack>
      ))}
    </ScrollArea>
  );
};

interface ColumnHeaderProps {
  column: TicketBoardColumn;
  onCreateStart?: (columnId: string) => void;
  onColumnAction?: (columnId: string, actionId: string) => Promise<void> | void;
}

interface GroupSectionProps {
  group: TicketBoardGroup;
  selectedItemId: string | null;
  canDragIn: boolean;
  canDragOut: boolean;
  isDropTarget: boolean;
  onDragStart: (itemId: string) => (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onGroupDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onGroupDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onGroupDrop: (event: DragEvent<HTMLDivElement>) => void;
}

const GroupSection = (props: GroupSectionProps) => {
  const {
    group,
    selectedItemId,
    canDragIn,
    canDragOut,
    isDropTarget,
    onDragStart,
    onDragEnd,
    onGroupDragOver,
    onGroupDragLeave,
    onGroupDrop,
  } = props;
  const [expanded, setExpanded] = useState(true);

  return (
    <Stack
      gap="0"
      borderRadius="sm"
      background={isDropTarget ? "bg.subtle" : "transparent"}
      transition="background 150ms ease"
      onDragOver={canDragIn ? onGroupDragOver : undefined}
      onDragLeave={canDragIn ? onGroupDragLeave : undefined}
      onDrop={canDragIn ? onGroupDrop : undefined}
    >
      <HStack
        px="xs"
        py="2xs"
        gap="2xs"
        cursor="pointer"
        _hover={{ bg: "bg.muted" }}
        borderRadius="sm"
        onClick={() => setExpanded((v) => !v)}
      >
        <Box display="flex" alignItems="center" flexShrink={0}>
          <Icon
            as={ChevronRight}
            boxSize="14px"
            color="fg.muted"
            transform={expanded ? "rotate(90deg)" : "rotate(0deg)"}
            transition="transform 0.15s ease"
          />
        </Box>
        <Text textStyle="label/S/medium" color="fg.muted">
          {group.label}
        </Text>
        <Badge variant="subtle" colorPalette="gray" size="sm">
          {group.items.length}
        </Badge>
      </HStack>
      {expanded && (
        <Stack gap="sm" pt="xs">
          {group.items.map((item) => (
            <TicketCard
              key={item.id}
              {...item.cardProps}
              isSelected={item.id === selectedItemId}
              draggable={canDragOut}
              onDragStart={canDragOut ? onDragStart(item.id) : undefined}
              onDragEnd={canDragOut ? onDragEnd : undefined}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
};

const ColumnHeader = (props: ColumnHeaderProps) => {
  const { column, onCreateStart, onColumnAction } = props;

  return (
    <HStack padding="xs" gap="xs" alignItems="center">
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
