import { useLayoutEffect, useState } from "react";
import type { Diff } from "./diff-card";
import {
  estimateDiffRangeHeight,
  getElementScrollOffset,
  getRenderedDiffItems,
  resolveSelectedScrollState,
} from "./diff-drawer-scroll";
import type { DiffViewMode } from "./types";

import type { DiffExpansionCommand } from "./diff-drawer";

interface UseSelectedDiffScrollInput {
  diffs: Diff[];
  selectedDiffPath: string | null;
  collapsedPaths: Set<string>;
  largeDiffOptInPaths: Set<string>;
  expansionCommand: DiffExpansionCommand | null;
  diffViewMode: DiffViewMode;
  scrollRef: { current: HTMLDivElement | null };
}

const SELECTED_ALIGNMENT_THRESHOLD = 72;
const getDiffPath = (diff: Diff) => diff.newPath ?? diff.oldPath ?? "unknown";

export const useSelectedDiffScroll = (input: UseSelectedDiffScrollInput) => {
  const { diffs, selectedDiffPath, collapsedPaths, largeDiffOptInPaths, expansionCommand, diffViewMode, scrollRef } =
    input;
  const [completedScrollCommandId, setCompletedScrollCommandId] = useState<number | null>(null);
  const {
    selectedScrollPath,
    selectedScrollKey,
    selectedScrollCommandId,
    selectedScrollIndex,
    shouldPinSelectedScrollIndex,
    hasCompletedSelectedScroll,
  } = resolveSelectedScrollState({
    diffs,
    selectedDiffPath,
    collapsedPaths,
    expansionCommand,
    completedScrollCommandId,
  });

  useLayoutEffect(() => {
    if (!selectedScrollPath || !selectedScrollKey) return;
    if (hasCompletedSelectedScroll) return;

    const index = diffs.findIndex((diff) => getDiffPath(diff) === selectedScrollPath);
    if (index < 0) return;

    const frameIds: number[] = [];
    let cancelledByUserScroll = false;
    const scrollElement = scrollRef.current;
    const cancelSelectedScroll = () => {
      cancelledByUserScroll = true;
      if (selectedScrollCommandId !== null) {
        setCompletedScrollCommandId(selectedScrollCommandId);
      }
    };
    const estimateRangeHeight = (startIndex: number, endIndex: number) => {
      return estimateDiffRangeHeight({
        diffs,
        collapsedPaths,
        largeDiffOptInPaths,
        diffViewMode,
        startIndex,
        endIndex,
      });
    };
    const scrollToOffset = (offset: number) => {
      if (cancelledByUserScroll) return;
      scrollRef.current?.scrollTo({ top: Math.max(0, offset), behavior: "auto" });
    };
    const scrollToSelectedDiff = () => scrollToOffset(estimateRangeHeight(0, index));
    const alignRenderedSelectedDiff = () => {
      const renderedItems = getRenderedDiffItems(scrollRef.current);
      const selectedItem = renderedItems.find((item) => item.index === index);
      if (selectedItem) {
        const selectedOffset = getElementScrollOffset({ element: selectedItem.element, scrollElement });
        const currentOffset = selectedOffset - (scrollElement?.scrollTop ?? 0);
        if (Math.abs(currentOffset) >= SELECTED_ALIGNMENT_THRESHOLD) {
          scrollToOffset(selectedOffset);
        }
        return Math.abs(currentOffset) < SELECTED_ALIGNMENT_THRESHOLD;
      }

      const firstItem = renderedItems[0];
      const lastItem = renderedItems.at(-1);
      if (firstItem && firstItem.index > index) {
        scrollToOffset(
          getElementScrollOffset({ element: firstItem.element, scrollElement }) -
            estimateRangeHeight(index, firstItem.index),
        );
        return false;
      }
      if (lastItem && lastItem.index < index) {
        scrollToOffset(
          getElementScrollOffset({ element: lastItem.element, scrollElement }) +
            estimateRangeHeight(lastItem.index, index),
        );
        return false;
      }
      if (!firstItem || !lastItem) {
        scrollToSelectedDiff();
      }
      return false;
    };
    let alignmentAttempts = 0;
    const reconcileSelectedDiff = () => {
      if (cancelledByUserScroll) return;
      const isAligned = alignRenderedSelectedDiff();
      alignmentAttempts += 1;
      const hasSettled = alignmentAttempts >= 3;
      if (isAligned && hasSettled && !collapsedPaths.has(selectedScrollPath) && selectedScrollCommandId !== null) {
        setCompletedScrollCommandId(selectedScrollCommandId);
        return;
      }
      if ((!isAligned || !hasSettled) && alignmentAttempts < 10) {
        frameIds.push(requestAnimationFrame(reconcileSelectedDiff));
      }
    };

    scrollElement?.addEventListener("wheel", cancelSelectedScroll, { passive: true });
    scrollElement?.addEventListener("touchmove", cancelSelectedScroll, { passive: true });
    const isInitiallyAligned = alignRenderedSelectedDiff();
    if (!shouldPinSelectedScrollIndex && !isInitiallyAligned) {
      scrollToSelectedDiff();
    }

    frameIds.push(requestAnimationFrame(reconcileSelectedDiff));

    return () => {
      scrollElement?.removeEventListener("wheel", cancelSelectedScroll);
      scrollElement?.removeEventListener("touchmove", cancelSelectedScroll);
      for (const frameId of frameIds) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [
    selectedScrollKey,
    selectedScrollPath,
    selectedScrollCommandId,
    shouldPinSelectedScrollIndex,
    hasCompletedSelectedScroll,
    diffs,
    collapsedPaths,
    largeDiffOptInPaths,
    diffViewMode,
    scrollRef,
  ]);

  return { selectedScrollIndex, shouldPinSelectedScrollIndex };
};
