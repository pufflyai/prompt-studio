import { Box, Stack } from "@chakra-ui/react";
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { type Diff, DiffCard } from "./diff-card";
import { DiffDrawerEmptyState } from "./diff-drawer-empty-state";
import { estimateDiffCardHeight } from "./diff-drawer-height";
import { includePinnedDiffIndexes } from "./diff-drawer-scroll";
import type { DiffViewMode } from "./types";
import { useSelectedDiffScroll } from "./use-selected-diff-scroll";

interface DiffDrawerProps {
  diffs: Diff[];
  selectedDiffPath?: string | null;
  onLoadDiff?: (path: string) => Promise<void>;
  onSelectDiffPath?: (path: string) => void;
  onExpansionStateChange?: (state: DiffDrawerExpansionState) => void;
  expansionCommand?: DiffExpansionCommand | null;
  diffViewMode?: DiffViewMode;
}

export interface DiffExpansionCommand {
  action: "expand" | "collapse" | "expand-selected";
  id: number;
  path?: string;
  direction?: "up" | "down";
}

export interface DiffDrawerExpansionState {
  allExpanded: boolean;
  allCollapsed: boolean;
}

export { estimateDiffCardHeight } from "./diff-drawer-height";
export type { Diff };

const getDiffPath = (diff: Diff) => diff.newPath ?? diff.oldPath ?? "unknown";

const INITIAL_EXPANDED_DIFF_COUNT = 10;
const INITIAL_COLLAPSED_LINE_THRESHOLD = 100;

export const buildInitialCollapsedPaths = (diffs: Diff[]) => {
  if (diffs.length <= INITIAL_EXPANDED_DIFF_COUNT) return new Set<string>();

  return new Set(
    diffs
      .filter((diff, index) => {
        const lineCount = (diff.additions ?? 0) + (diff.deletions ?? 0);
        return index >= INITIAL_EXPANDED_DIFF_COUNT || lineCount > INITIAL_COLLAPSED_LINE_THRESHOLD;
      })
      .map((diff) => getDiffPath(diff)),
  );
};

export const buildAllCollapsedPaths = (diffs: Diff[]) => new Set(diffs.map((diff) => getDiffPath(diff)));

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
  const {
    diffs,
    selectedDiffPath = null,
    onLoadDiff,
    onSelectDiffPath,
    onExpansionStateChange,
    expansionCommand = null,
    diffViewMode = "unified",
  } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const reportedExpansionStateRef = useRef<DiffDrawerExpansionState | null>(null);
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(() => buildInitialCollapsedPaths(diffs));
  const [largeDiffOptInPaths, setLargeDiffOptInPaths] = useState<Set<string>>(() => new Set());
  const { selectedScrollIndex, shouldPinSelectedScrollIndex } = useSelectedDiffScroll({
    diffs,
    selectedDiffPath,
    collapsedPaths,
    largeDiffOptInPaths,
    expansionCommand,
    diffViewMode,
    scrollRef,
  });

  const virtualizer = useVirtualizer({
    count: diffs.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const diff = diffs[index];
      const path = getDiffPath(diff);
      return estimateDiffCardHeight({
        diff,
        isCollapsed: collapsedPaths.has(path),
        hasOptedIntoLargeDiff: largeDiffOptInPaths.has(path),
        diffViewMode,
      });
    },
    getItemKey: (index) => getDiffPath(diffs[index]),
    overscan: 3,
    rangeExtractor: (range) => {
      const indexes = defaultRangeExtractor(range);
      return includePinnedDiffIndexes({ indexes, selectedScrollIndex, shouldPinSelectedScrollIndex });
    },
  });
  virtualizer.shouldAdjustScrollPositionOnItemSizeChange = (_item, _delta, instance) => !instance.isScrolling;

  useLayoutEffect(() => {
    if (!selectedDiffPath) return;

    setCollapsedPaths((prev) => resolveCollapsedPathsForSelectedDiff(diffs, prev, selectedDiffPath));
  }, [diffs, selectedDiffPath]);

  useLayoutEffect(() => {
    if (!expansionCommand) return;

    if (expansionCommand.action === "expand-selected") {
      setCollapsedPaths((prev) =>
        expansionCommand.path ? resolveCollapsedPathsForSelectedDiff(diffs, prev, expansionCommand.path) : prev,
      );
      return;
    }

    setCollapsedPaths(expansionCommand.action === "collapse" ? buildAllCollapsedPaths(diffs) : new Set());
  }, [diffs, expansionCommand]);

  useEffect(() => {
    const expansionState = {
      allExpanded: collapsedPaths.size === 0,
      allCollapsed: diffs.length > 0 && diffs.every((diff) => collapsedPaths.has(getDiffPath(diff))),
    };
    const reportedExpansionState = reportedExpansionStateRef.current;
    if (
      reportedExpansionState?.allExpanded === expansionState.allExpanded &&
      reportedExpansionState.allCollapsed === expansionState.allCollapsed
    ) {
      return;
    }

    reportedExpansionStateRef.current = expansionState;
    onExpansionStateChange?.(expansionState);
  }, [collapsedPaths, diffs, onExpansionStateChange]);

  if (diffs.length === 0) return <DiffDrawerEmptyState />;

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
    <Stack h="full" minH="0" gap="0" bg="bg">
      <Box position="relative" flex="1" minH="0" bg="bg">
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
                  style={{ top: `${virtualItem.start}px` }}
                >
                  <DiffCard
                    key={path}
                    diff={diff}
                    isSelected={selectedDiffPath === path}
                    isExpanded={!collapsedPaths.has(path)}
                    onToggleExpanded={() => toggleExpanded(path)}
                    onSelect={() => onSelectDiffPath?.(path)}
                    onLoadDiff={onLoadDiff}
                    hasOptedIntoLargeDiff={largeDiffOptInPaths.has(path)}
                    onShowFullDiff={() => showFullDiff(path)}
                    diffViewMode={diffViewMode}
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
