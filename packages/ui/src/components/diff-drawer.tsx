import { Box, Stack } from "@chakra-ui/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useState } from "react";
import { type Diff, DiffCard } from "./diff-card";
import { isLargeDiffContent } from "./diff-size";
import { buildDiffViewData } from "./diff-view-adapter";
import { EmptyState } from "./empty-state";
import { ScrollArea } from "./scroll-area";

interface DiffDrawerProps {
  diffs: Diff[];
  selectedDiffPath?: string | null;
  onLoadDiff?: (path: string) => Promise<void>;
}

export type { Diff };

const getDiffPath = (diff: Diff) => diff.newPath ?? diff.oldPath ?? "unknown";

const CARD_HEADER_HEIGHT = 36;
const CARD_BODY_LINE_HEIGHT = 18;
const COLLAPSED_CARD_HEIGHT = 44;
const DEFERRED_BODY_HEIGHT = 88;
const ITEM_GAP_HEIGHT = 8;
const INITIAL_EXPANDED_DIFF_COUNT = 20;

const renderedDiffRowCountCache = new WeakMap<Diff, number>();

const hasLoadedDiffContent = (diff: Diff) => diff.oldContent !== undefined || diff.newContent !== undefined;

const countRenderedDiffRows = (diff: Diff) => {
  const cachedRowCount = renderedDiffRowCountCache.get(diff);
  if (cachedRowCount !== undefined) return cachedRowCount;

  const data = buildDiffViewData({
    original: diff.oldContent ?? "",
    modified: diff.newContent ?? "",
    oldPath: diff.oldPath,
    newPath: diff.newPath,
  });
  const rowCount = data.hunks.reduce((total, hunk) => {
    return total + hunk.split("\n").filter(Boolean).length;
  }, 0);

  renderedDiffRowCountCache.set(diff, rowCount);
  return rowCount;
};

export const estimateDiffCardHeight = (diff: Diff, isCollapsed: boolean, hasOptedIntoLargeDiff = false) => {
  if (isCollapsed) return COLLAPSED_CARD_HEIGHT + ITEM_GAP_HEIGHT;
  if (isLargeDiffContent(diff) && !hasOptedIntoLargeDiff) {
    return CARD_HEADER_HEIGHT + DEFERRED_BODY_HEIGHT + ITEM_GAP_HEIGHT;
  }

  const lineCount = (diff.additions ?? 0) + (diff.deletions ?? 0);
  if (lineCount === 0) {
    return CARD_HEADER_HEIGHT + DEFERRED_BODY_HEIGHT + ITEM_GAP_HEIGHT;
  }
  if (!hasLoadedDiffContent(diff)) {
    return CARD_HEADER_HEIGHT + lineCount * CARD_BODY_LINE_HEIGHT + ITEM_GAP_HEIGHT;
  }

  const renderedRows = countRenderedDiffRows(diff);

  return CARD_HEADER_HEIGHT + Math.max(lineCount, renderedRows) * CARD_BODY_LINE_HEIGHT + ITEM_GAP_HEIGHT;
};

export const buildInitialCollapsedPaths = (diffs: Diff[]) =>
  new Set(diffs.slice(INITIAL_EXPANDED_DIFF_COUNT).map((diff) => getDiffPath(diff)));

export const toggleCollapsedPath = (collapsedPaths: Set<string>, path: string) => {
  const next = new Set(collapsedPaths);
  if (next.has(path)) {
    next.delete(path);
  } else {
    next.add(path);
  }
  return next;
};

export const resolveCollapsedPathsForSelectedDiff = (
  diffs: Diff[],
  collapsedPaths: Set<string>,
  selectedDiffPath: string | null,
) => {
  if (!selectedDiffPath) return collapsedPaths;
  if (!collapsedPaths.has(selectedDiffPath)) return collapsedPaths;
  if (!diffs.some((diff) => getDiffPath(diff) === selectedDiffPath)) return collapsedPaths;

  const next = new Set(collapsedPaths);
  next.delete(selectedDiffPath);
  return next;
};

export function DiffDrawer(props: DiffDrawerProps) {
  const { diffs, selectedDiffPath = null, onLoadDiff } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(() => buildInitialCollapsedPaths(diffs));
  const [largeDiffOptInPaths, setLargeDiffOptInPaths] = useState<Set<string>>(() => new Set());

  const virtualizer = useVirtualizer({
    count: diffs.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const diff = diffs[index];
      const path = getDiffPath(diff);
      return estimateDiffCardHeight(diff, collapsedPaths.has(path), largeDiffOptInPaths.has(path));
    },
    getItemKey: (index) => getDiffPath(diffs[index]),
    overscan: 5,
  });

  useEffect(() => {
    if (!selectedDiffPath) return;

    const index = diffs.findIndex((diff) => getDiffPath(diff) === selectedDiffPath);
    if (index < 0) return;

    virtualizer.scrollToIndex(index, { align: "start", behavior: "auto" });
  }, [selectedDiffPath, diffs, virtualizer]);

  useEffect(() => {
    if (!selectedDiffPath) return;

    setCollapsedPaths((prev) => resolveCollapsedPathsForSelectedDiff(diffs, prev, selectedDiffPath));
  }, [diffs, selectedDiffPath]);

  if (diffs.length === 0) {
    return (
      <Stack h="full" minH="0" gap="0">
        <ScrollArea flex="1" minH="0" contentProps={{ p: "xs", spaceY: "xs" }}>
          <EmptyState title="No changes detected" description="Make some changes to see the diff here." paddingY="sm" />
        </ScrollArea>
      </Stack>
    );
  }

  const toggleExpanded = (path: string) => {
    setCollapsedPaths((prev) => toggleCollapsedPath(prev, path));
  };

  const showFullDiff = (path: string) => {
    setLargeDiffOptInPaths((prev) => {
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  };

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <Stack h="full" minH="0" gap="0">
      <Box position="relative" flex="1" minH="0">
        <ScrollArea
          position="absolute"
          inset="0"
          viewportRef={scrollRef}
          viewportProps={{ style: { overflowAnchor: "none" } }}
          contentProps={{ p: "xs" }}
        >
          <Box position="relative" width="100%" style={{ height: virtualizer.getTotalSize() }}>
            {virtualItems.map((virtualItem) => {
              const diff = diffs[virtualItem.index];
              const path = getDiffPath(diff);

              return (
                <Box
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  position="absolute"
                  left="0"
                  width="100%"
                  pb="xs"
                  style={{ top: virtualItem.start }}
                >
                  <DiffCard
                    key={path}
                    diff={diff}
                    isSelected={selectedDiffPath === path}
                    isExpanded={!collapsedPaths.has(path)}
                    onToggleExpanded={() => toggleExpanded(path)}
                    onLoadDiff={onLoadDiff}
                    hasOptedIntoLargeDiff={largeDiffOptInPaths.has(path)}
                    onShowFullDiff={() => showFullDiff(path)}
                  />
                </Box>
              );
            })}
          </Box>
        </ScrollArea>
      </Box>
    </Stack>
  );
}
