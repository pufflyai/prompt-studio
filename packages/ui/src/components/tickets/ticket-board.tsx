import { Box, Stack } from "@chakra-ui/react";
import { type ComponentProps, type ComponentType, type DragEvent, useState } from "react";

import { ScrollArea } from "@/components/scroll-area";

import { BoardColumnHeader } from "./board-column-header";
import { BoardGroupSection } from "./board-group-section";
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
  color?: string;
  icon?: string | null;
  items: TicketBoardItem[];
}

export interface TicketBoardColumn {
  id: string;
  label: string;
  color?: string;
  icon?: string | null;
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
  onReorderItem?: (itemId: string, columnId: string, targetIndex: number) => void;
  onCreateStart?: (columnId: string) => void;
  onColumnAction?: (columnId: string, actionId: string) => Promise<void> | void;
}

interface DropIndicatorState {
  columnId: string;
  index: number;
}

export const TicketBoard = (props: TicketBoardProps) => {
  const {
    columns,
    selectedItemId = null,
    onMoveItem,
    onMoveToGroup,
    onReorderItem,
    onCreateStart,
    onColumnAction,
  } = props;

  const [activeColumn, setActiveColumn] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicatorState | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

  const handleDragStart = (itemId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData("text/plain", itemId);
    event.dataTransfer.effectAllowed = "move";
    setDraggedItemId(itemId);
  };

  const handleDragEnd = () => {
    setActiveColumn(null);
    setActiveGroup(null);
    setDropIndicator(null);
    setDraggedItemId(null);
  };

  const handleDragOver = (columnId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setActiveColumn(columnId);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    setActiveColumn(null);
    setDropIndicator(null);
  };

  const handleDrop = (columnId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setActiveColumn(null);

    const itemId = event.dataTransfer.getData("text/plain");
    if (!itemId) return;

    if (dropIndicator && dropIndicator.columnId === columnId && onReorderItem) {
      onReorderItem(itemId, columnId, dropIndicator.index);
      setDropIndicator(null);
      return;
    }

    setDropIndicator(null);
    onMoveItem?.(itemId, columnId);
  };

  const handleCardDragOver = (columnId: string, index: number) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";

    const rect = event.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const dropIndex = event.clientY < midY ? index : index + 1;

    setDropIndicator({ columnId, index: dropIndex });
    setActiveColumn(columnId);
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
          <BoardColumnHeader column={column} onCreateStart={onCreateStart} onColumnAction={onColumnAction} />

          <ScrollArea
            flex="1"
            minH="0"
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
                    <BoardGroupSection
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
              : column.items.map((item, index) => (
                  <Box key={item.id} position="relative">
                    {dropIndicator?.columnId === column.id &&
                      dropIndicator.index === index &&
                      draggedItemId !== item.id && <Box height="2px" bg="blue.500" borderRadius="full" mb="xs" />}
                    <Box onDragOver={onReorderItem ? handleCardDragOver(column.id, index) : undefined}>
                      <TicketCard
                        {...item.cardProps}
                        isSelected={item.id === selectedItemId}
                        draggable={column.canDragOut}
                        onDragStart={column.canDragOut ? handleDragStart(item.id) : undefined}
                        onDragEnd={column.canDragOut ? handleDragEnd : undefined}
                      />
                    </Box>
                    {dropIndicator?.columnId === column.id &&
                      dropIndicator.index === index + 1 &&
                      index === column.items.length - 1 &&
                      draggedItemId !== item.id && <Box height="2px" bg="blue.500" borderRadius="full" mt="xs" />}
                  </Box>
                ))}
          </ScrollArea>
        </Stack>
      ))}
    </ScrollArea>
  );
};
