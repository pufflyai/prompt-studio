import { Box, Stack, Text, useSlotRecipe } from "@chakra-ui/react";
import { defaultRangeExtractor } from "@tanstack/react-virtual";
import { type DragEvent, type KeyboardEvent, useLayoutEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { useVirtualizer } from "@/utils/use-virtualizer";
import { CollectionLoadMore } from "../collection-view/collection-load-more";
import type { KanbanRendererBoardColumn } from "./kanban-renderer-board";
import { BoardEntry, type BoardEntryData } from "./kanban-renderer-board-entry";
import { shouldVirtualizeKanban } from "./kanban-renderer-virtualization";

interface BoardColumnCardsProps {
  onLoadMore?: () => void;
  loadingMore?: boolean;
  column: KanbanRendererBoardColumn;
  selectedItemId: string | null;
  draggedKey: string | null;
  revealedItemId: string | null;
  onDragStart: (itemId: string) => (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onDragTarget: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>, beforeItemId?: string, groupKey?: string) => void;
}

export const BoardColumnCards = (props: BoardColumnCardsProps) => {
  const { column, selectedItemId, draggedKey, revealedItemId, onDragStart, onDragEnd, onDragTarget, onDrop } = props;
  const recipe = useSlotRecipe({ key: "kanbanBoardColumn" });
  const styles = recipe();
  const viewport = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const entries: BoardEntryData[] = column.groups?.length
    ? column.groups.flatMap((group) => [
        { key: JSON.stringify(["group", column.id, group.key]), group },
        ...(collapsed[group.key]
          ? []
          : group.items.map((item) => ({
              key: JSON.stringify(["row", column.id, group.key, item.id]),
              item,
              groupKey: group.key,
            }))),
      ])
    : column.items.map((item) => ({ key: JSON.stringify(["row", column.id, item.id]), item }));
  const virtualize = shouldVirtualizeKanban(entries.length);
  const { virtualizer, virtualItems, totalSize } = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: entries.length,
    enabled: virtualize,
    onChange: (instance, scrolling) => {
      if (scrolling && instance.range && instance.range.endIndex >= entries.length - 1) props.onLoadMore?.();
    },
    getScrollElement: () => viewport.current,
    getItemKey: (index) => entries[index].key,
    estimateSize: (index) => (entries[index].group ? 32 : 100),
    overscan: 5,
    rangeExtractor: (range) => {
      const indexes = new Set(defaultRangeExtractor(range));
      for (const key of [focusedKey, focusTarget, draggedKey]) {
        const index = entries.findIndex((entry) => entry.key === key);
        if (index >= 0) indexes.add(index);
      }
      for (const id of [revealedItemId]) {
        const index = entries.findIndex((entry) => entry.item?.id === id);
        if (index >= 0) indexes.add(index);
      }
      return [...indexes].sort((a, b) => a - b);
    },
  });
  const revealIndex = entries.findIndex((entry) => entry.item?.id === revealedItemId);
  const revealKey = revealIndex >= 0 ? entries[revealIndex]?.key : undefined;
  useLayoutEffect(() => {
    if (!revealKey) return;
    if (virtualize) {
      virtualizer.scrollToIndex(revealIndex, { align: "auto" });
      return;
    }
    const target = [...(viewport.current?.querySelectorAll<HTMLElement>("[data-board-key]") ?? [])].find(
      (element) => element.dataset.boardKey === revealKey,
    );
    target?.scrollIntoView({ block: "nearest" });
  }, [revealIndex, revealKey, virtualize, virtualizer]);
  useLayoutEffect(() => {
    if (!focusTarget) return;
    const target = [...(viewport.current?.querySelectorAll<HTMLElement>("[data-board-key]") ?? [])].find(
      (element) => element.dataset.boardKey === focusTarget,
    );
    target?.focus({ preventScroll: virtualize });
    if (target) setFocusTarget(null);
  }, [focusTarget, virtualize]);

  const handleKeyboard = (event: KeyboardEvent<HTMLDivElement>, index: number) => {
    if (event.target !== event.currentTarget) return;
    let target = index;
    if (event.key === "ArrowDown") target = Math.min(index + 1, entries.length - 1);
    else if (event.key === "ArrowUp") target = Math.max(index - 1, 0);
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = entries.length - 1;
    else return;
    event.preventDefault();
    if (virtualize) virtualizer.scrollToIndex(target, { align: "auto" });
    setFocusTarget(entries[target].key);
  };
  const dragOver = (event: DragEvent<HTMLDivElement>, key: string, card: boolean) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setDropKey(key);
    if (card) onDragTarget();
  };
  const renderedEntries = virtualize
    ? virtualItems.map((virtual) => ({ entry: entries[virtual.index], index: virtual.index, start: virtual.start }))
    : entries.map((entry, index) => ({ entry, index, start: undefined }));

  return (
    <ScrollArea
      flex="1"
      minH="0"
      size="xs"
      viewportRef={viewport}
      viewportProps={{
        ...{ "data-board-column-viewport": column.id },
        "aria-label": column.label,
        onScroll: (event) => {
          if (virtualize) return;
          const viewport = event.currentTarget;
          if (viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight > 8) return;
          if (!props.loadingMore) props.onLoadMore?.();
        },
        onWheel: (event) => {
          const viewport = event.currentTarget;
          if (event.deltaY > 0 && viewport.scrollHeight <= viewport.clientHeight) props.onLoadMore?.();
        },
      }}
      verticalScrollbarProps={{ css: styles.scrollbar }}
    >
      {column.items.length === 0 && column.totalCount ? (
        <Stack css={styles.empty} alignItems="center" gap="2xs" paddingY="xl" textAlign="center">
          <Text textStyle="label/S/regular" color="fg.muted">
            No matching cards
          </Text>
          <Text textStyle="label/XS" color="fg.subtle">
            {column.totalCount} {column.totalCount === 1 ? "card" : "cards"} hidden by search
          </Text>
        </Stack>
      ) : null}
      <Box position={virtualize ? "relative" : undefined} height={virtualize ? `${totalSize}px` : undefined}>
        {renderedEntries.map(({ entry, index, start }) => {
          const { item, group } = entry;
          const groupKey = group?.key ?? entry.groupKey;
          const drop = (event: DragEvent<HTMLDivElement>) => {
            setDropKey(null);
            onDrop(event, item?.id, groupKey);
          };
          return (
            <Box
              key={entry.key}
              data-index={index}
              ref={start === undefined ? undefined : virtualizer.measureElement}
              position={start === undefined ? undefined : "absolute"}
              top={start === undefined ? undefined : `${start}px`}
              left={start === undefined ? undefined : "0"}
              width="full"
              css={styles.entry}
              data-column-id={column.id}
              data-group-key={groupKey}
            >
              <BoardEntry
                entry={entry}
                index={index}
                selectedItemId={selectedItemId}
                collapsed={Boolean(group && collapsed[group.key])}
                dropTarget={dropKey === entry.key}
                onFocus={() => setFocusedKey(entry.key)}
                onKeyboard={handleKeyboard}
                onToggle={() => {
                  if (group) setCollapsed((current) => ({ ...current, [group.key]: !current[group.key] }));
                }}
                onDragOver={(event) => dragOver(event, entry.key, Boolean(item))}
                onDrop={drop}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              />
            </Box>
          );
        })}
      </Box>
      {props.onLoadMore && (column.count ?? 0) > column.items.length ? (
        <CollectionLoadMore label="Load more cards" loading={props.loadingMore} onLoadMore={props.onLoadMore} />
      ) : null}
    </ScrollArea>
  );
};
