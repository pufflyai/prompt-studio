import { Box, Stack } from "@chakra-ui/react";
import { type ComponentProps, type ComponentType, type DragEvent, useState } from "react";

import { ScrollArea } from "@/components/scroll-area";

import { ColumnHeader } from "./board-column-header";
import { GroupSection } from "./board-group-section";
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

interface DropIndicator {
  columnId: string;
  index: number;
}

interface TicketBoardProps {
  columns: TicketBoardColumn[];
  selectedItemId?: string | null;
  onMoveItem?: (itemId: string, targetColumnId: string) => void;
  onMoveToGroup?: (itemId: string, targetGroupKey: string) => void;
  onReorderItem?: (itemId: string, columnId: string, newIndex: number) => void;
  onCreateStart?: (columnId: string) => void;
  onColumnAction?: (columnId: string, actionId: string) => Promise<void> | void;
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
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);
  const [dragSourceColumn, setDragSourceColumn] = useState<string | null>(null);

  const handleDragStart = (itemId: string, columnId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData("text/plain", itemId);
    event.dataTransfer.effectAllowed = "move";
    setDragSourceColumn(columnId);
  };

  const handleDragEnd = () => {
    setActiveColumn(null);
    setActiveGroup(null);
    setDropIndicator(null);
    setDragSourceColumn(null);
  };

  const handleDragOver = (columnId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (columnId !== dragSourceColumn) {
      setActiveColumn(columnId);
      setDropIndicator(null);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    setActiveColumn(null);
    setDropIndicator(null);
  };

  const handleCardDragOver = (columnId: string, cardIndex: number) => (event: DragEvent<HTMLDivElement>) => {
    if (columnId !== dragSourceColumn || !onReorderItem) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";

    const rect = event.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const insertIndex = event.clientY < midY ? cardIndex : cardIndex + 1;

    setDropIndicator({ columnId, index: insertIndex });
    setActiveColumn(null);
  };

  const handleCardDrop = (columnId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const itemId = event.dataTransfer.getData("text/plain");
    if (!itemId || !dropIndicator) return;

    onReorderItem?.(itemId, columnId, dropIndicator.index);
    setDropIndicator(null);
    setDragSourceColumn(null);
    setActiveColumn(null);
  };

  const handleDrop = (columnId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setActiveColumn(null);
    setDropIndicator(null);

    const itemId = event.dataTransfer.getData("text/plain");
    if (!itemId) return;

    onMoveItem?.(itemId, columnId);
  };

  const renderCardWithIndicator = (item: TicketBoardItem, index: number, columnId: string, canDragOut: boolean) => {
    const canReorder = onReorderItem && dragSourceColumn === columnId;
    const showIndicatorBefore = dropIndicator?.columnId === columnId && dropIndicator.index === index;

    return (
      <Box key={item.id}>
        {showIndicatorBefore && <DropLine />}
        <Box
          onDragOver={canReorder ? handleCardDragOver(columnId, index) : undefined}
          onDrop={canReorder ? handleCardDrop(columnId) : undefined}
        >
          <TicketCard
            {...item.cardProps}
            isSelected={item.id === selectedItemId}
            draggable={canDragOut}
            onDragStart={canDragOut ? handleDragStart(item.id, columnId) : undefined}
            onDragEnd={canDragOut ? handleDragEnd : undefined}
          />
        </Box>
      </Box>
    );
  };

  return (
    <ScrollArea
      height="100%"
      showHorizontalScrollbar
      showVerticalScrollbar={false}
      contentProps={{ display: "flex", alignItems: "stretch", gap: "0", pb: "2xs", minH: "100%" }}
    >
      {columns.map((column) => {
        const showTrailingIndicator =
          dropIndicator?.columnId === column.id && dropIndicator.index === column.items.length;

        return (
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
                        group={group}
                        columnId={column.id}
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
                : column.items.map((item, index) => renderCardWithIndicator(item, index, column.id, column.canDragOut))}
              {showTrailingIndicator && <DropLine />}
            </ScrollArea>
          </Stack>
        );
      })}
    </ScrollArea>
  );
};

const DropLine = () => <Box height="2px" bg="blue.500" borderRadius="full" mx="2xs" />;
