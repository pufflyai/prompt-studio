import { useEffect, useLayoutEffect, useRef } from "react";

const TAIL_READY_STABLE_FRAME_COUNT = 3;
const TAIL_READY_FRAME_LIMIT = 20;
const TAIL_READY_PIXEL_EPSILON = 1;

interface TailLayoutSnapshot {
  scrollTop: number;
  totalSize: number;
}

const isTailLayoutStable = (current: TailLayoutSnapshot, previous: TailLayoutSnapshot) =>
  Math.abs(current.scrollTop - previous.scrollTop) <= TAIL_READY_PIXEL_EPSILON &&
  Math.abs(current.totalSize - previous.totalSize) <= TAIL_READY_PIXEL_EPSILON;

// A tail that fits in the viewport has no scroll position to settle, so it can show at once.
const tailFitsViewport = (scrollElement: HTMLElement | null) =>
  Boolean(scrollElement) && scrollElement!.scrollHeight <= scrollElement!.clientHeight;

const readTailLayoutSnapshot = (scrollElement: HTMLElement | null) => ({
  scrollTop: scrollElement?.scrollTop ?? 0,
  totalSize: scrollElement?.scrollHeight ?? 0,
});

export const useTailReady = (input: { onReady?: () => void; scrollRef: { current: HTMLElement | null } }) => {
  const { onReady, scrollRef } = input;
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  // Runs before paint, so a conversation that fits is never hidden for the frames a long one waits.
  // One mount owns one settling window. Stream updates must not restart its frame limit.
  useLayoutEffect(() => {
    if (typeof requestAnimationFrame === "undefined" || tailFitsViewport(scrollRef.current)) {
      onReadyRef.current?.();
      return;
    }

    let frameId = 0;
    let checkedFrameCount = 0;
    let stableFrameCount = 0;
    let previousSnapshot: TailLayoutSnapshot | null = null;

    const waitForStableTail = () => {
      checkedFrameCount += 1;

      const nextSnapshot = readTailLayoutSnapshot(scrollRef.current);
      stableFrameCount =
        previousSnapshot && isTailLayoutStable(nextSnapshot, previousSnapshot) ? stableFrameCount + 1 : 0;
      previousSnapshot = nextSnapshot;

      if (stableFrameCount >= TAIL_READY_STABLE_FRAME_COUNT || checkedFrameCount >= TAIL_READY_FRAME_LIMIT) {
        onReadyRef.current?.();
        return;
      }

      frameId = requestAnimationFrame(waitForStableTail);
    };

    frameId = requestAnimationFrame(waitForStableTail);

    return () => cancelAnimationFrame(frameId);
  }, [scrollRef]);
};
