import { Box } from "@chakra-ui/react";
import { defaultRangeExtractor } from "@tanstack/react-virtual";
import { type ComponentType, type ReactNode, useRef, useState } from "react";
import type { ResourceContextAction } from "@/components/overlays/resource-context-menu";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { useVirtualizer } from "@/utils/use-virtualizer";
import { CollectionPageBoundary } from "../collection-view/collection-page-boundary";
import type { AttributeBadge } from "./kanban-renderer-helpers";
import { KanbanRendererListRow } from "./kanban-renderer-list-row";
import { KanbanListSkeletonRows } from "./kanban-renderer-skeleton";
import { shouldVirtualizeKanban } from "./kanban-renderer-virtualization";

export interface KanbanRendererListItem {
  id: string;
  eyebrow?: string;
  title: string;
  /** Search text to mark in the title and eyebrow. */
  highlight?: string;
  isGroup?: boolean;
  note?: string;
  onNoteClick?: () => void;
  onCreate?: () => void;
  expandOnClick?: boolean;
  countBadge?: number;
  /** Unloaded rows in this group, when the provider supplies a full count. */
  remainingRows?: number;
  countColorPalette?: string;
  statusIcon?: ComponentType<{ size?: number | string }>;
  statusColor?: string;
  statusColorPalette?: string;
  badges?: AttributeBadge[];
  customSlots?: ReactNode[];
  children?: KanbanRendererListItem[];
  onClick?: () => void;
  onBadgeChange?: (attributeId: string, value: unknown) => void;
  contextMenuActions?: ResourceContextAction[];
  draggable?: boolean;
  onDropRow?: (rowId: string) => void;
}

export type KanbanRendererListExpandedState = Record<string, boolean>;

export interface KanbanRendererListProps {
  onLoadMore?: () => void;
  loadingMore?: boolean;
  pageCursor?: string | null;
  items: KanbanRendererListItem[];
  selectedItemId?: string | null;
  expandedGroups?: KanbanRendererListExpandedState;
  onItemClick?: (item: KanbanRendererListItem) => void;
  onExpandedGroupChange?: (rowId: string, isExpanded: boolean) => void;
}

export interface FlattenedKanbanRendererListItem {
  id: string;
  item: KanbanRendererListItem;
  depth: number;
  isGroup: boolean;
  canExpand: boolean;
  pageBoundary?: true;
}

export const flattenKanbanRendererListItems = (
  items: KanbanRendererListItem[],
  expanded: KanbanRendererListExpandedState,
  depth = 0,
  includePageBoundaries = false,
) => {
  const rows: FlattenedKanbanRendererListItem[] = [];

  for (const item of items) {
    const hasMore = (item.remainingRows ?? 0) > 0;
    const canExpand = (item.children?.length ?? 0) > 0 || (includePageBoundaries && hasMore);
    rows.push({
      id: item.id,
      item,
      depth,
      isGroup: item.isGroup === true,
      canExpand,
    });

    if (canExpand && getRowIsExpanded(expanded, item.id)) {
      rows.push(...flattenKanbanRendererListItems(item.children ?? [], expanded, depth + 1, includePageBoundaries));
      if (includePageBoundaries && hasMore) {
        rows.push({
          id: JSON.stringify(["next-page", item.id]),
          item,
          depth: depth + 1,
          isGroup: false,
          canExpand: false,
          pageBoundary: true,
        });
      }
    }
  }

  return rows;
};

const getRowIsExpanded = (expandedState: KanbanRendererListExpandedState, rowId: string) => {
  return expandedState[rowId] !== false;
};

const updateExpandedState = (expandedState: KanbanRendererListExpandedState, rowId: string, isExpanded: boolean) => {
  return { ...expandedState, [rowId]: isExpanded };
};

const pageSkeletonCount = 3;
const listRowEstimate = 35;
const skeletonCount = (row?: FlattenedKanbanRendererListItem) =>
  Math.min(pageSkeletonCount, row?.item.remainingRows ?? pageSkeletonCount);

export const KanbanRendererList = (props: KanbanRendererListProps) => {
  const { items, selectedItemId = null, expandedGroups, onItemClick, onExpandedGroupChange } = props;
  const [localExpandedGroups, setLocalExpandedGroups] = useState<KanbanRendererListExpandedState>({});
  const [activeDropTargetId, setActiveDropTargetId] = useState<string | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const expanded = expandedGroups ?? localExpandedGroups;
  const hasNextPage = Boolean(props.pageCursor || props.onLoadMore || props.loadingMore);
  const pagedGroups = items.some((item) => item.remainingRows !== undefined);
  const rows = flattenKanbanRendererListItems(items, expanded, 0, hasNextPage && pagedGroups);
  const virtualize = shouldVirtualizeKanban(rows.length);
  const pageBoundary = (row?: FlattenedKanbanRendererListItem) => (
    <CollectionPageBoundary
      key={props.pageCursor ?? rows.length}
      loading={props.loadingMore && !draggedItemId}
      onLoadMore={draggedItemId ? undefined : props.onLoadMore}
      loadingLabel={row ? `Loading more items in ${row.item.title}` : undefined}
      placeholder={<KanbanListSkeletonRows count={skeletonCount(row)} depth={row?.depth} />}
      reservePlaceholderSpace
    />
  );

  const handleExpandedChange = (rowId: string, isExpanded: boolean) => {
    onExpandedGroupChange?.(rowId, isExpanded);
    if (expandedGroups === undefined) {
      setLocalExpandedGroups((current) => updateExpandedState(current, rowId, isExpanded));
    }
  };

  const viewport = useRef<HTMLDivElement>(null);
  const { virtualizer, virtualItems, totalSize } = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: rows.length,
    enabled: virtualize,
    getScrollElement: () => viewport.current,
    getItemKey: (index) => rows[index].id,
    estimateSize: (index) => {
      const row = rows[index];
      if (row.pageBoundary) return skeletonCount(row) * listRowEstimate;
      return row.isGroup ? 29 : listRowEstimate;
    },
    overscan: 10,
    // Active rows keep their DOM node when scrolled beyond the visible range.
    rangeExtractor: (range) => {
      const indexes = new Set(defaultRangeExtractor(range));
      for (const id of [draggedItemId, focusedItemId]) {
        const index = rows.findIndex((row) => row.id === id);
        if (index >= 0) indexes.add(index);
      }
      return [...indexes].sort((a, b) => a - b);
    },
  });
  const renderedRows = virtualize
    ? virtualItems.map((virtual) => ({ row: rows[virtual.index], index: virtual.index, start: virtual.start }))
    : rows.map((row, index) => ({ row, index, start: undefined }));

  return (
    <ScrollArea flex="1" minH="0" viewportRef={viewport} viewportProps={{ "aria-label": "Collection list" }}>
      <Box position={virtualize ? "relative" : undefined} height={virtualize ? `${totalSize}px` : undefined}>
        {renderedRows.map(({ row, index, start }) => {
          return (
            <Box
              key={row.id}
              data-index={index}
              ref={start === undefined ? undefined : virtualizer.measureElement}
              position={start === undefined ? undefined : "absolute"}
              top={start === undefined ? undefined : `${start}px`}
              left={start === undefined ? undefined : "0"}
              width="full"
              onFocusCapture={() => setFocusedItemId(row.id)}
              onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setFocusedItemId(null);
              }}
            >
              {row.pageBoundary ? (
                pageBoundary(row)
              ) : (
                <KanbanRendererListRow
                  row={row}
                  isExpanded={getRowIsExpanded(expanded, row.id)}
                  selectedItemId={selectedItemId}
                  activeDropTargetId={activeDropTargetId}
                  draggedItemId={draggedItemId}
                  onDraggedItemChange={setDraggedItemId}
                  onDropTargetChange={setActiveDropTargetId}
                  onItemClick={onItemClick}
                  onExpandedChange={handleExpandedChange}
                />
              )}
            </Box>
          );
        })}
      </Box>
      {hasNextPage && !pagedGroups ? pageBoundary() : null}
    </ScrollArea>
  );
};
