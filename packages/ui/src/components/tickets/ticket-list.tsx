import { Box, HStack } from "@chakra-ui/react";
import {
  type ColumnDef,
  type ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  type Row,
  useReactTable,
} from "@tanstack/react-table";
import { type ComponentType, type DragEvent, type ReactNode, useEffect, useState } from "react";

import type { TicketCardBadge } from "./ticket-card";
import { TicketCell } from "./ticket-list-cell";

export interface TicketListItem {
  id: string;
  ticketId: string;
  title: string;
  statusIcon?: ComponentType<{ size?: number | string }>;
  statusColor?: string;
  badges?: TicketCardBadge[];
  date?: string;
  assigneeIcon?: ReactNode;
  children?: TicketListItem[];
  onClick?: () => void;
}

interface TicketListProps {
  items: TicketListItem[];
  selectedItemId?: string | null;
  draggable?: boolean;
  draggableItemIds?: Set<string>;
  dropTargetGroupIds?: Set<string>;
  onItemClick?: (item: TicketListItem) => void;
  onMoveItem?: (itemId: string, targetGroupKey: string) => void;
}

const columns: ColumnDef<TicketListItem, unknown>[] = [
  {
    id: "ticket",
    header: "",
    cell: ({ row }) => <TicketCell row={row} />,
  },
];

// Column group IDs are "group::<columnKey>", extract just the column key
export const extractColumnKey = (groupId: string) => groupId.replace(/^group::/, "");

export const isGroupRowId = (rowId: string) => rowId.startsWith("group::");

interface RowDragStateInput {
  rowId: string;
  rowDepth: number;
  draggable: boolean;
  hasMoveHandler: boolean;
  draggableItemIds?: Set<string>;
  dropTargetGroupIds?: Set<string>;
}

interface RowDragState {
  isGroupRow: boolean;
  isTopLevelGroupRow: boolean;
  isDraggableRow: boolean;
  isDropTargetRow: boolean;
}

export const classifyRowDragState = (input: RowDragStateInput): RowDragState => {
  const { rowId, rowDepth, draggable, hasMoveHandler, draggableItemIds, dropTargetGroupIds } = input;

  const isGroupRow = isGroupRowId(rowId);
  const isTopLevelGroupRow = isGroupRow && rowDepth === 0;

  const isItemDraggable = draggableItemIds ? draggableItemIds.has(rowId) : true;
  const isGroupDropTarget = dropTargetGroupIds ? dropTargetGroupIds.has(rowId) : true;

  return {
    isGroupRow,
    isTopLevelGroupRow,
    isDraggableRow: draggable && !isGroupRow && isItemDraggable,
    isDropTargetRow: draggable && hasMoveHandler && isTopLevelGroupRow && isGroupDropTarget,
  };
};

export const TicketList = (props: TicketListProps) => {
  const {
    items,
    selectedItemId = null,
    draggable = false,
    draggableItemIds,
    dropTargetGroupIds,
    onItemClick,
    onMoveItem,
  } = props;

  const [expanded, setExpanded] = useState<ExpandedState>(() => getDefaultExpandedState(items));
  const [activeDropTarget, setActiveDropTarget] = useState<string | null>(null);

  useEffect(() => {
    setExpanded((previous) => mergeExpandedState(previous, items));
  }, [items]);

  const table = useReactTable({
    data: items,
    columns,
    state: { expanded },
    onExpandedChange: setExpanded,
    getSubRows: (row) => row.children,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowId: (row) => row.id,
  });

  const handleDragStart = (itemId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData("text/plain", itemId);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (groupId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setActiveDropTarget(groupId);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    setActiveDropTarget(null);
  };

  const handleDrop = (groupId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setActiveDropTarget(null);
    const itemId = event.dataTransfer.getData("text/plain");
    if (!itemId) return;
    onMoveItem?.(itemId, extractColumnKey(groupId));
  };

  const handleDragEnd = () => {
    setActiveDropTarget(null);
  };

  return (
    <Box>
      {table.getRowModel().rows.map((row) => (
        <TicketListRow
          key={row.id}
          row={row}
          selectedItemId={selectedItemId}
          draggable={draggable}
          draggableItemIds={draggableItemIds}
          dropTargetGroupIds={dropTargetGroupIds}
          activeDropTarget={activeDropTarget}
          onItemClick={onItemClick}
          onMoveItem={onMoveItem}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
        />
      ))}
    </Box>
  );
};

interface TicketListRowProps {
  row: Row<TicketListItem>;
  selectedItemId: string | null;
  draggable: boolean;
  draggableItemIds?: Set<string>;
  dropTargetGroupIds?: Set<string>;
  activeDropTarget: string | null;
  onItemClick?: (item: TicketListItem) => void;
  onMoveItem?: (itemId: string, targetGroupKey: string) => void;
  onDragStart: (itemId: string) => (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (groupId: string) => (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (groupId: string) => (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}

const TicketListRow = (props: TicketListRowProps) => {
  const {
    row,
    selectedItemId,
    draggable,
    draggableItemIds,
    dropTargetGroupIds,
    activeDropTarget,
    onItemClick,
    onMoveItem,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd,
  } = props;

  const item = row.original;
  const isSelected = item.id === selectedItemId;
  const canExpand = row.getCanExpand();
  const { isTopLevelGroupRow, isDraggableRow, isDropTargetRow } = classifyRowDragState({
    rowId: item.id,
    rowDepth: row.depth,
    draggable,
    hasMoveHandler: !!onMoveItem,
    draggableItemIds,
    dropTargetGroupIds,
  });

  const rowBackground = activeDropTarget === item.id ? "bg.subtle" : isSelected ? "bg.active" : "transparent";

  return (
    <HStack
      paddingX="sm"
      paddingY="xs"
      gap="sm"
      cursor={isDraggableRow ? "grab" : "pointer"}
      borderBottomWidth="1px"
      borderColor="border.muted"
      background={rowBackground}
      _hover={{ background: isSelected ? "bg.active" : "bg.hover" }}
      transition="background 150ms ease"
      onClick={() => {
        if (isTopLevelGroupRow && canExpand) {
          row.toggleExpanded();
          return;
        }

        if (isTopLevelGroupRow) {
          return;
        }

        item.onClick?.();
        onItemClick?.(item);
      }}
      data-selected={isSelected ? "true" : undefined}
      draggable={isDraggableRow}
      onDragStart={isDraggableRow ? onDragStart(item.id) : undefined}
      onDragEnd={isDraggableRow ? onDragEnd : undefined}
      onDragOver={isDropTargetRow ? onDragOver(item.id) : undefined}
      onDragLeave={isDropTargetRow ? onDragLeave : undefined}
      onDrop={isDropTargetRow ? onDrop(item.id) : undefined}
    >
      {flexRender(row.getVisibleCells()[0].column.columnDef.cell, row.getVisibleCells()[0].getContext())}
    </HStack>
  );
};

function getDefaultExpandedState(items: TicketListItem[]) {
  const expandedState: ExpandedState = {};

  const visit = (entries: TicketListItem[]) => {
    for (const item of entries) {
      if (!item.children || item.children.length === 0) {
        continue;
      }

      expandedState[item.id] = true;
      visit(item.children);
    }
  };

  visit(items);
  return expandedState;
}

function mergeExpandedState(previous: ExpandedState, items: TicketListItem[]) {
  if (previous === true) {
    return getDefaultExpandedState(items);
  }

  const nextState: ExpandedState = {};

  const visit = (entries: TicketListItem[]) => {
    for (const item of entries) {
      if (!item.children || item.children.length === 0) {
        continue;
      }

      nextState[item.id] = previous[item.id] ?? true;
      visit(item.children);
    }
  };

  visit(items);
  return nextState;
}
