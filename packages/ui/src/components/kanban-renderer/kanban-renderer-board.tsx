import { Stack, useSlotRecipe } from "@chakra-ui/react";
import { type ComponentProps, type ComponentType, type DragEvent, useState } from "react";

import type { ResourceContextAction } from "@/components/overlays/resource-context-menu";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { BoardColumnCards } from "./kanban-renderer-board-column";
import { ColumnHeader } from "./kanban-renderer-board-column-header";
import type { KanbanRendererCard } from "./kanban-renderer-card";
import { useBoardDragScroll } from "./use-board-drag-scroll";
import { useBoardPan } from "./use-board-pan";

type KanbanRendererCardProps = ComponentProps<typeof KanbanRendererCard>;

export interface KanbanRendererBoardItem {
  id: string;
  cardProps: Omit<KanbanRendererCardProps, "draggable" | "onDragStart" | "onDragEnd" | "isSelected">;
  contextMenuActions?: ResourceContextAction[];
}

export interface KanbanRendererBoardColumnAction {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number | string }>;
}

export interface KanbanRendererBoardGroup {
  count?: number;
  key: string;
  label: string;
  items: KanbanRendererBoardItem[];
}

export interface KanbanRendererBoardColumn {
  count?: number;
  id: string;
  label: string;
  createLabel?: string;
  color?: string;
  icon?: string | null;
  items: KanbanRendererBoardItem[];
  groups?: KanbanRendererBoardGroup[];
  /** Cards in the column before search narrowed it. Set only while a search is active. */
  totalCount?: number;
  /** @deprecated Remove this option. Cards can always be dragged between columns. */
  canDragIn?: boolean;
  /** @deprecated Remove this option. Cards can always be dragged between columns. */
  canDragOut?: boolean;
  canCreate: boolean;
  actions: KanbanRendererBoardColumnAction[];
}

interface KanbanRendererBoardProps {
  onLoadMore?: () => void;
  loadingMore?: boolean;
  columns: KanbanRendererBoardColumn[];
  selectedItemId?: string | null;
  onMoveItem?: (
    itemId: string,
    targetColumnId: string,
    context?: { beforeItemId?: string; targetGroupKey?: string },
  ) => Promise<void> | void;
  onMoveToGroup?: (itemId: string, targetGroupKey: string, context?: { beforeItemId?: string }) => Promise<void> | void;
  onCreateStart?: (columnId: string) => void;
  onColumnAction?: (columnId: string, actionId: string) => Promise<void> | void;
}

export const KanbanRendererBoard = (props: KanbanRendererBoardProps) => {
  const { columns, selectedItemId = null, onMoveItem, onMoveToGroup, onCreateStart, onColumnAction } = props;
  const columnRecipe = useSlotRecipe({ key: "kanbanBoardColumn" });
  const columnStyles = columnRecipe();

  const [activeColumn, setActiveColumn] = useState<string | null>(null);
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [revealedItemId, setRevealedItemId] = useState<string | null>(null);
  const panViewportProps = useBoardPan();
  const dragScroll = useBoardDragScroll();

  const handleDragStart = (itemId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData("text/plain", itemId);
    event.dataTransfer.effectAllowed = "move";
    setDraggedKey(event.currentTarget.closest<HTMLElement>("[data-board-key]")?.dataset.boardKey ?? null);
    dragScroll.startDrag(event);
  };

  const handleDragEnd = () => {
    setActiveColumn(null);
    setDraggedKey(null);
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

    setRevealedItemId(itemId);
    onMoveItem?.(itemId, columnId);
  };

  return (
    <ScrollArea
      height="100%"
      size="xs"
      showHorizontalScrollbar
      showVerticalScrollbar={false}
      viewportRef={dragScroll.viewportRef}
      viewportProps={panViewportProps}
      contentProps={{ display: "flex", alignItems: "stretch", gap: "xs", padding: "xs", minH: "100%" }}
    >
      {columns.map((column) => (
        <Stack
          key={column.id}
          data-testid={`board-column-${column.id}`}
          gap="xs"
          css={columnStyles.root}
          borderWidth="1px"
          borderColor="border.subtle"
          borderRadius="sm"
          background={activeColumn === column.id ? "bg.active" : "bg.subtle"}
          transition="background 150ms ease"
          height="100%"
          minH="240px"
          overflow="hidden"
          minW="260px"
          flex="1 0 260px"
          onDragOver={handleDragOver(column.id)}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop(column.id)}
        >
          <ColumnHeader column={column} onCreateStart={onCreateStart} onColumnAction={onColumnAction} />

          <BoardColumnCards
            onLoadMore={props.onLoadMore}
            loadingMore={props.loadingMore}
            column={column}
            selectedItemId={selectedItemId}
            draggedKey={draggedKey}
            revealedItemId={revealedItemId}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragTarget={() => setActiveColumn(column.id)}
            onDrop={(event, beforeItemId, targetGroupKey) => {
              event.preventDefault();
              event.stopPropagation();
              setActiveColumn(null);
              setDraggedKey(null);
              const itemId = event.dataTransfer.getData("text/plain");
              if (!itemId || itemId === beforeItemId) return;
              setRevealedItemId(itemId);
              if (onMoveItem) onMoveItem(itemId, column.id, { beforeItemId, targetGroupKey });
              else if (targetGroupKey) onMoveToGroup?.(itemId, targetGroupKey, { beforeItemId });
            }}
          />
        </Stack>
      ))}
    </ScrollArea>
  );
};
