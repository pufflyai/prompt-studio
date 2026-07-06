import type { Virtualizer } from "@tanstack/react-virtual";
import { useLayoutEffect, useState } from "react";
import type { Diff } from "./diff-card";
import type { DiffExpansionCommand } from "./diff-drawer";
import { resolveSelectedScrollState } from "./diff-drawer-scroll";

interface UseSelectedDiffScrollInput {
  diffs: Diff[];
  selectedDiffPath: string | null;
  collapsedPaths: Set<string>;
  expansionCommand: DiffExpansionCommand | null;
  scrollRef: { current: HTMLDivElement | null };
  virtualizerRef: { current: Virtualizer<HTMLDivElement, Element> | null };
  suppressScrollAdjustRef: { current: boolean };
}

// Re-align for a few frames so the target settles as it and its neighbours measure, then latch the
// command as done. Capped so a diff that never settles can't spin the animation loop.
const SETTLE_FRAME_COUNT = 3;
const MAX_ALIGNMENT_FRAMES = 12;

const getDiffPath = (diff: Diff) => diff.newPath ?? diff.oldPath ?? "unknown";

export const useSelectedDiffScroll = (input: UseSelectedDiffScrollInput) => {
  const {
    diffs,
    selectedDiffPath,
    collapsedPaths,
    expansionCommand,
    scrollRef,
    virtualizerRef,
    suppressScrollAdjustRef,
  } = input;
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
    // Selecting a collapsed diff expands it first (a sibling layout effect updates collapsedPaths and
    // re-runs this one). Wait for that: scrolling to a card that is about to grow lands on a stale
    // offset and snaps once it expands. Once expanded, its measured offset is stable.
    if (collapsedPaths.has(selectedScrollPath)) return;

    const index = diffs.findIndex((diff) => getDiffPath(diff) === selectedScrollPath);
    if (index < 0) return;

    const virtualizer = virtualizerRef.current;
    const scrollElement = scrollRef.current;
    if (!virtualizer || !scrollElement) return;

    const frameIds: number[] = [];
    let cancelledByUserScroll = false;
    // Drive the scroll from the virtualizer's measured card heights (not per-diff estimates) and hold
    // its keep-in-place adjustments off while we do, so a mid-list target lands where it actually is
    // instead of overshooting and snapping back — the "wild jump" when opening files further down.
    suppressScrollAdjustRef.current = true;
    const stopAligning = () => {
      suppressScrollAdjustRef.current = false;
    };
    const cancelSelectedScroll = () => {
      cancelledByUserScroll = true;
      stopAligning();
      if (selectedScrollCommandId !== null) {
        setCompletedScrollCommandId(selectedScrollCommandId);
      }
    };

    let alignmentFrames = 0;
    const alignSelectedDiff = () => {
      if (cancelledByUserScroll) return;
      virtualizer.scrollToIndex(index, { align: "start" });
      alignmentFrames += 1;
      if (alignmentFrames >= SETTLE_FRAME_COUNT && selectedScrollCommandId !== null) {
        stopAligning();
        setCompletedScrollCommandId(selectedScrollCommandId);
        return;
      }
      if (alignmentFrames < MAX_ALIGNMENT_FRAMES) {
        frameIds.push(requestAnimationFrame(alignSelectedDiff));
        return;
      }
      stopAligning();
    };

    scrollElement.addEventListener("wheel", cancelSelectedScroll, { passive: true });
    scrollElement.addEventListener("touchmove", cancelSelectedScroll, { passive: true });
    alignSelectedDiff();

    return () => {
      stopAligning();
      scrollElement.removeEventListener("wheel", cancelSelectedScroll);
      scrollElement.removeEventListener("touchmove", cancelSelectedScroll);
      for (const frameId of frameIds) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [
    selectedScrollKey,
    selectedScrollPath,
    selectedScrollCommandId,
    hasCompletedSelectedScroll,
    diffs,
    collapsedPaths,
    scrollRef,
    virtualizerRef,
    suppressScrollAdjustRef,
  ]);

  return { selectedScrollIndex, shouldPinSelectedScrollIndex };
};
