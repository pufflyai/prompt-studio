import type { Diff } from "./diff-card";
import { estimateDiffCardHeight } from "./diff-drawer-height";
import type { DiffViewMode } from "./types";

interface EstimateDiffRangeHeightInput {
  diffs: Diff[];
  collapsedPaths: Set<string>;
  largeDiffOptInPaths: Set<string>;
  diffViewMode: DiffViewMode;
  startIndex: number;
  endIndex: number;
}

interface SelectedExpansionCommand {
  action: string;
  id: number;
  path?: string;
  direction?: "up" | "down";
}

interface ResolveSelectedScrollStateInput {
  diffs: Diff[];
  selectedDiffPath: string | null;
  collapsedPaths: Set<string>;
  expansionCommand: SelectedExpansionCommand | null;
  completedScrollCommandId: number | null;
}

export interface RenderedDiffItem {
  element: HTMLElement;
  index: number;
}

const getDiffPath = (diff: Diff) => diff.newPath ?? diff.oldPath ?? "unknown";
const PINNED_DIFF_LOOKBEHIND_COUNT = 24;

export const estimateDiffRangeHeight = (input: EstimateDiffRangeHeightInput) => {
  const { diffs, collapsedPaths, largeDiffOptInPaths, diffViewMode, startIndex, endIndex } = input;
  let offset = 0;
  for (let diffIndex = startIndex; diffIndex < endIndex; diffIndex += 1) {
    const diff = diffs[diffIndex];
    const path = getDiffPath(diff);
    offset += estimateDiffCardHeight({
      diff,
      isCollapsed: collapsedPaths.has(path),
      hasOptedIntoLargeDiff: largeDiffOptInPaths.has(path),
      diffViewMode,
    });
  }
  return offset;
};

export const resolveSelectedScrollState = (input: ResolveSelectedScrollStateInput) => {
  const { diffs, selectedDiffPath, collapsedPaths, expansionCommand, completedScrollCommandId } = input;
  let selectedScrollPath = selectedDiffPath;
  let selectedScrollSourceKey = selectedDiffPath ? `selected:${selectedDiffPath}` : null;
  const selectedScrollCommandId = expansionCommand?.action === "expand-selected" ? expansionCommand.id : null;
  const hasCompletedSelectedScroll =
    selectedScrollCommandId !== null && completedScrollCommandId === selectedScrollCommandId;

  if (expansionCommand?.action === "expand-selected" && expansionCommand.path) {
    selectedScrollPath = expansionCommand.path;
    selectedScrollSourceKey = `command:${expansionCommand.id}:${expansionCommand.path}`;
  }

  let selectedScrollKey = selectedScrollSourceKey;
  if (selectedScrollPath && selectedScrollSourceKey) {
    const selectedScrollExpansionState = collapsedPaths.has(selectedScrollPath) ? "collapsed" : "expanded";
    selectedScrollKey = `${selectedScrollSourceKey}:${selectedScrollExpansionState}`;
  }

  const selectedScrollIndex = selectedScrollPath
    ? diffs.findIndex((diff) => getDiffPath(diff) === selectedScrollPath)
    : -1;
  const shouldPinSelectedScrollIndex =
    selectedScrollIndex >= 0 &&
    expansionCommand?.action === "expand-selected" &&
    expansionCommand.direction === "up" &&
    !hasCompletedSelectedScroll;

  return {
    selectedScrollPath,
    selectedScrollKey,
    selectedScrollCommandId,
    selectedScrollIndex,
    shouldPinSelectedScrollIndex,
    hasCompletedSelectedScroll,
  };
};

export const includePinnedDiffIndexes = (input: {
  indexes: number[];
  selectedScrollIndex: number;
  shouldPinSelectedScrollIndex: boolean;
}) => {
  const { indexes, selectedScrollIndex, shouldPinSelectedScrollIndex } = input;
  if (!shouldPinSelectedScrollIndex || indexes.includes(selectedScrollIndex)) return indexes;

  const pinnedStartIndex = Math.max(0, selectedScrollIndex - PINNED_DIFF_LOOKBEHIND_COUNT);
  const pinnedIndexes = Array.from(
    { length: selectedScrollIndex - pinnedStartIndex + 1 },
    (_, index) => pinnedStartIndex + index,
  );

  return Array.from(new Set([...indexes, ...pinnedIndexes])).sort((a, b) => a - b);
};

export const getRenderedDiffItems = (scrollElement: HTMLElement | null) =>
  Array.from(scrollElement?.querySelectorAll<HTMLElement>("[data-index]") ?? [])
    .filter((element) => element.querySelector('[data-testid="diff-card"]'))
    .map((element) => ({ element, index: Number(element.dataset.index) }))
    .filter((item): item is RenderedDiffItem => Number.isInteger(item.index))
    .sort((a, b) => a.index - b.index);

export const getElementScrollOffset = (input: { element: HTMLElement; scrollElement: HTMLElement | null }) => {
  const { element, scrollElement } = input;
  if (!scrollElement) return element.offsetTop;

  const elementRect = element.getBoundingClientRect();
  const scrollRect = scrollElement.getBoundingClientRect();
  return scrollElement.scrollTop + elementRect.top - scrollRect.top;
};
