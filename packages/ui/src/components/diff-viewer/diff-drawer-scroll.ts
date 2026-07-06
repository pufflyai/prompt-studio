import type { Diff } from "./diff-card";

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

const getDiffPath = (diff: Diff) => diff.newPath ?? diff.oldPath ?? "unknown";
const PINNED_DIFF_LOOKBEHIND_COUNT = 24;

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
