import { Box, Stack } from "@chakra-ui/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "../empty-state";
import { ScrollArea } from "../scroll-area";
import { type Diff, DiffCard } from "./diff-card";
import { isLargeDiffContent } from "./diff-size";
import { buildDiffViewData } from "./diff-view-adapter";
import type { DiffViewMode } from "./types";

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
}

export interface DiffDrawerExpansionState {
  allExpanded: boolean;
  allCollapsed: boolean;
}

export type { Diff };

const getDiffPath = (diff: Diff) => diff.newPath ?? diff.oldPath ?? "unknown";

const CARD_HEADER_HEIGHT = 36;
const CARD_BODY_LINE_HEIGHT = 18;
const HUNK_ROW_HEIGHT = 28;
const COLLAPSED_CARD_HEIGHT = 44;
const DEFERRED_BODY_HEIGHT = 88;
const ITEM_GAP_HEIGHT = 8;
const INITIAL_EXPANDED_DIFF_COUNT = 10;
const INITIAL_COLLAPSED_LINE_THRESHOLD = 100;

interface EstimateDiffCardHeightInput {
  diff: Diff;
  isCollapsed: boolean;
  hasOptedIntoLargeDiff?: boolean;
  diffViewMode?: DiffViewMode;
}

const deferredCardHeight = () => CARD_HEADER_HEIGHT + DEFERRED_BODY_HEIGHT + ITEM_GAP_HEIGHT;

// Mirrors the branches DiffCardContent renders, so the virtualizer's estimate matches the DOM
// before measureElement gets a chance to refine it.
export const estimateDiffCardHeight = (input: EstimateDiffCardHeightInput) => {
  const { diff, isCollapsed, hasOptedIntoLargeDiff = false, diffViewMode = "unified" } = input;

  if (isCollapsed) return COLLAPSED_CARD_HEIGHT + ITEM_GAP_HEIGHT;

  const hasDiffContent = diff.oldContent !== undefined || diff.newContent !== undefined;
  if (!hasDiffContent) return deferredCardHeight();
  if (isLargeDiffContent(diff) && !hasOptedIntoLargeDiff) return deferredCardHeight();

  const { unifiedContentRows, splitContentRows, hunkRows } = buildDiffViewData({
    original: diff.oldContent ?? "",
    modified: diff.newContent ?? "",
    oldPath: diff.oldPath,
    newPath: diff.newPath,
  });
  const contentRows = diffViewMode === "split" ? splitContentRows : unifiedContentRows;
  if (contentRows === 0 && hunkRows === 0) return deferredCardHeight();

  const bodyHeight = contentRows * CARD_BODY_LINE_HEIGHT + hunkRows * HUNK_ROW_HEIGHT;
  return CARD_HEADER_HEIGHT + bodyHeight + ITEM_GAP_HEIGHT;
};

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
  });

  useEffect(() => {
    if (!selectedDiffPath) return;

    setCollapsedPaths((prev) => resolveCollapsedPathsForSelectedDiff(diffs, prev, selectedDiffPath));
  }, [diffs, selectedDiffPath]);

  useEffect(() => {
    if (!selectedDiffPath) return;

    const index = diffs.findIndex((diff) => getDiffPath(diff) === selectedDiffPath);
    if (index < 0) return;

    virtualizer.scrollToIndex(index, { align: "start", behavior: "auto" });
  }, [selectedDiffPath, diffs, virtualizer]);

  useEffect(() => {
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

  if (diffs.length === 0) {
    return (
      <Stack h="full" minH="0" gap="0" bg="bg">
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
                  style={{ top: virtualItem.start }}
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
