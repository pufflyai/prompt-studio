import { Box } from "@chakra-ui/react";
import { defaultRangeExtractor } from "@tanstack/react-virtual";
import { type ComponentType, type ReactNode, useRef, useState } from "react";
import type { ResourceContextAction } from "@/components/overlays/resource-context-menu";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { useVirtualizer } from "@/utils/use-virtualizer";
import { CollectionLoadMore } from "../collection-view/collection-load-more";
import type { AttributeBadge } from "./kanban-renderer-helpers";
import { KanbanRendererListRow } from "./kanban-renderer-list-row";

export interface KanbanRendererListItem {
  id: string;
  eyebrow?: string;
  title: string;
  /** Search text to mark in the title and eyebrow. */
  highlight?: string;
  isGroup?: boolean;
  countBadge?: number;
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
  items: KanbanRendererListItem[];
  selectedItemId?: string | null;
  expandedGroups?: KanbanRendererListExpandedState;
  onItemClick?: (item: KanbanRendererListItem) => void;
  onExpandedGroupChange?: (rowId: string, isExpanded: boolean) => void;
}

const INDENT_STEP_PX = 12;

export interface FlattenedKanbanRendererListItem {
  id: string;
  item: KanbanRendererListItem;
  depth: number;
  isGroup: boolean;
  canExpand: boolean;
}

export const getKanbanRendererListIndentation = (depth: number) => {
  if (depth <= 0) return undefined;
  return `${depth * INDENT_STEP_PX}px`;
};

export const flattenKanbanRendererListItems = (
  items: KanbanRendererListItem[],
  expanded: KanbanRendererListExpandedState,
  depth = 0,
) => {
  const rows: FlattenedKanbanRendererListItem[] = [];

  for (const item of items) {
    const canExpand = (item.children?.length ?? 0) > 0;
    rows.push({
      id: item.id,
      item,
      depth,
      isGroup: item.isGroup === true,
      canExpand,
    });

    if (canExpand && getRowIsExpanded(expanded, item.id)) {
      rows.push(...flattenKanbanRendererListItems(item.children ?? [], expanded, depth + 1));
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

export const KanbanRendererList = (props: KanbanRendererListProps) => {
  const { items, selectedItemId = null, expandedGroups, onItemClick, onExpandedGroupChange } = props;
  const [localExpandedGroups, setLocalExpandedGroups] = useState<KanbanRendererListExpandedState>({});
  const [activeDropTargetId, setActiveDropTargetId] = useState<string | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const expanded = expandedGroups ?? localExpandedGroups;
  const rows = flattenKanbanRendererListItems(items, expanded);

  const handleExpandedChange = (rowId: string, isExpanded: boolean) => {
    onExpandedGroupChange?.(rowId, isExpanded);
    if (expandedGroups === undefined) {
      setLocalExpandedGroups((current) => updateExpandedState(current, rowId, isExpanded));
    }
  };

  const viewport = useRef<HTMLDivElement>(null);
  const { virtualizer, virtualItems, totalSize } = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: rows.length,
    onChange: (instance, scrolling) => {
      if (scrolling && instance.range && instance.range.endIndex >= rows.length - 1) props.onLoadMore?.();
    },
    getScrollElement: () => viewport.current,
    getItemKey: (index) => rows[index].id,
    estimateSize: (index) => (rows[index].isGroup ? 29 : 35),
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

  return (
    <ScrollArea
      flex="1"
      minH="0"
      viewportRef={viewport}
      viewportProps={{
        "aria-label": "Collection list",
        onWheel: (event) => {
          const viewport = event.currentTarget;
          if (event.deltaY > 0 && viewport.scrollHeight <= viewport.clientHeight) props.onLoadMore?.();
        },
      }}
    >
      <Box position="relative" height={`${totalSize}px`}>
        {virtualItems.map((virtual) => {
          const row = rows[virtual.index];
          return (
            <Box
              key={row.id}
              data-index={virtual.index}
              ref={virtualizer.measureElement}
              position="absolute"
              top={`${virtual.start}px`}
              left="0"
              width="full"
              onFocusCapture={() => setFocusedItemId(row.id)}
              onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setFocusedItemId(null);
              }}
            >
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
            </Box>
          );
        })}
      </Box>
      {props.onLoadMore ? (
        <CollectionLoadMore label="Load more rows" loading={props.loadingMore} onLoadMore={props.onLoadMore} />
      ) : null}
    </ScrollArea>
  );
};
