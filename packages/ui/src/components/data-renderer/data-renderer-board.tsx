import { Badge, Box, HStack, Icon, IconButton, Menu, Spacer, Stack, Text } from "@chakra-ui/react";
import { ChevronRight, MoreHorizontal, Plus } from "lucide-react";
import { type ComponentProps, type ComponentType, type DragEvent, useState } from "react";

import { ListRow } from "@/components/list-row/list-row";
import type { ResourceContextAction } from "@/components/resource-context-menu";
import { ResourceContextMenu } from "@/components/resource-context-menu";
import { ScrollArea } from "@/components/scroll-area";
import { Tooltip } from "@/components/tooltip";

import { DataRendererCard } from "./data-renderer-card";

type DataRendererCardProps = ComponentProps<typeof DataRendererCard>;

export interface DataRendererBoardItem {
  id: string;
  cardProps: Omit<DataRendererCardProps, "draggable" | "onDragStart" | "onDragEnd" | "isSelected">;
  contextMenuActions?: ResourceContextAction[];
}

export interface DataRendererBoardColumnAction {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number | string }>;
}

export interface DataRendererBoardGroup {
  key: string;
  label: string;
  items: DataRendererBoardItem[];
}

export interface DataRendererBoardColumn {
  id: string;
  label: string;
  createLabel?: string;
  color?: string;
  items: DataRendererBoardItem[];
  groups?: DataRendererBoardGroup[];
  canDragIn: boolean;
  canDragOut: boolean;
  canCreate: boolean;
  actions: DataRendererBoardColumnAction[];
}

interface DataRendererBoardProps {
  columns: DataRendererBoardColumn[];
  selectedItemId?: string | null;
  onMoveItem?: (itemId: string, targetColumnId: string, context?: { beforeItemId?: string }) => void;
  onMoveToGroup?: (itemId: string, targetGroupKey: string, context?: { beforeItemId?: string }) => void;
  onCreateStart?: (columnId: string) => void;
  onColumnAction?: (columnId: string, actionId: string) => Promise<void> | void;
}

export const DataRendererBoard = (props: DataRendererBoardProps) => {
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
      size="xs"
      showHorizontalScrollbar
      showVerticalScrollbar={false}
      contentProps={{ display: "flex", alignItems: "stretch", gap: "0", pb: "2xs", minH: "100%" }}
    >
      {columns.map((column) => (
        <Stack
          key={column.id}
          data-testid={`board-column-${column.id}`}
          gap="xs"
          _notFirst={{ borderLeft: "1px solid", borderColor: "border.muted" }}
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

          <ScrollArea
            flex="1"
            minH="0"
            size="xs"
            verticalScrollbarProps={{ margin: "0" }}
            contentProps={{
              spaceY: "sm",
              ps: "xs",
              pe: "xs",
            }}
          >
            {column.groups && column.groups.length > 0
              ? column.groups.map((group) => {
                  const groupId = `${column.id}::${group.key}`;
                  return (
                    <GroupSection
                      key={group.key}
                      columnId={column.id}
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
                      onGroupDrop={(event, beforeItemId) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setActiveGroup(null);
                        setActiveColumn(null);
                        const itemId = event.dataTransfer.getData("text/plain");
                        if (!itemId) return;
                        onMoveItem?.(itemId, column.id, { beforeItemId });
                        onMoveToGroup?.(itemId, group.key, { beforeItemId });
                      }}
                    />
                  );
                })
              : column.items.map((item) => (
                  <ResourceContextMenu key={item.id} actions={item.contextMenuActions ?? []}>
                    <Box
                      onDragOver={
                        column.canDragIn
                          ? (event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              event.dataTransfer.dropEffect = "move";
                              setActiveColumn(column.id);
                            }
                          : undefined
                      }
                      onDrop={
                        column.canDragIn
                          ? (event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setActiveColumn(null);
                              const itemId = event.dataTransfer.getData("text/plain");
                              if (!itemId || itemId === item.id) return;
                              onMoveItem?.(itemId, column.id, { beforeItemId: item.id });
                            }
                          : undefined
                      }
                    >
                      <DataRendererCard
                        {...item.cardProps}
                        isSelected={item.id === selectedItemId}
                        draggable={column.canDragOut}
                        onDragStart={column.canDragOut ? handleDragStart(item.id) : undefined}
                        onDragEnd={column.canDragOut ? handleDragEnd : undefined}
                      />
                    </Box>
                  </ResourceContextMenu>
                ))}
          </ScrollArea>
        </Stack>
      ))}
    </ScrollArea>
  );
};

interface ColumnHeaderProps {
  column: DataRendererBoardColumn;
  onCreateStart?: (columnId: string) => void;
  onColumnAction?: (columnId: string, actionId: string) => Promise<void> | void;
}

interface GroupSectionProps {
  columnId: string;
  group: DataRendererBoardGroup;
  selectedItemId: string | null;
  canDragIn: boolean;
  canDragOut: boolean;
  isDropTarget: boolean;
  onDragStart: (itemId: string) => (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onGroupDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onGroupDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onGroupDrop: (event: DragEvent<HTMLDivElement>, beforeItemId?: string) => void;
}

const GroupSection = (props: GroupSectionProps) => {
  const {
    columnId,
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
      data-column-id={columnId}
      data-group-key={group.key}
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
        _hover={{ bg: "bg.hover" }}
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
        <Badge variant="subtle" bg="bg.muted" color="fg.muted" size="sm">
          {group.items.length}
        </Badge>
      </HStack>
      {expanded && (
        <Stack gap="sm" pt="xs">
          {group.items.map((item) => (
            <ResourceContextMenu key={item.id} actions={item.contextMenuActions ?? []}>
              <Box
                onDragOver={
                  canDragIn
                    ? (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        event.dataTransfer.dropEffect = "move";
                      }
                    : undefined
                }
                onDrop={
                  canDragIn
                    ? (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const itemId = event.dataTransfer.getData("text/plain");
                        if (!itemId || itemId === item.id) return;
                        onGroupDrop(event, item.id);
                      }
                    : undefined
                }
              >
                <DataRendererCard
                  {...item.cardProps}
                  isSelected={item.id === selectedItemId}
                  draggable={canDragOut}
                  onDragStart={canDragOut ? onDragStart(item.id) : undefined}
                  onDragEnd={canDragOut ? onDragEnd : undefined}
                />
              </Box>
            </ResourceContextMenu>
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

      <Badge
        variant="subtle"
        {...(column.color ? { colorPalette: column.color } : { bg: "bg.muted", color: "fg.muted" })}
      >
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
                    variant="compact"
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
