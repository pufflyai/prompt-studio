export const FRAME_RATE_SECONDS = 30;

// Whole seconds of drawn frames, oldest first. `count` is the open second.
export interface FrameRateState {
  buckets: number[];
  secondStartedAt: number;
  count: number;
}

export const emptyFrameRate = (now: number): FrameRateState => ({ buckets: [], secondStartedAt: now, count: 0 });

export const recordFrame = (state: FrameRateState, now: number): FrameRateState => {
  const elapsedSeconds = Math.floor((now - state.secondStartedAt) / 1000);
  if (elapsedSeconds < 1) return { ...state, count: state.count + 1 };
  // A long gap means no frames were drawn; those seconds count as zero.
  const missed = Math.min(elapsedSeconds - 1, FRAME_RATE_SECONDS);
  const buckets = [...state.buckets, state.count, ...Array<number>(missed).fill(0)].slice(-FRAME_RATE_SECONDS);
  return { buckets, secondStartedAt: state.secondStartedAt + elapsedSeconds * 1000, count: 1 };
};

// Counts the workbench window's animation frames while it is visible. A hidden
// window draws nothing, so the counter restarts instead of reporting a drop.
export const createFrameRateCounter = () => {
  let state = emptyFrameRate(performance.now());
  let handle: number | undefined;
  const listeners = new Set<() => void>();

  const tick = (now: number) => {
    const previous = state.buckets;
    state = recordFrame(state, now);
    if (state.buckets !== previous) for (const listener of listeners) listener();
    handle = requestAnimationFrame(tick);
  };
  const resume = () => {
    if (handle !== undefined || document.visibilityState === "hidden") return;
    state = { ...state, secondStartedAt: performance.now(), count: 0 };
    handle = requestAnimationFrame(tick);
  };
  const pause = () => {
    if (handle !== undefined) cancelAnimationFrame(handle);
    handle = undefined;
  };
  const onVisibility = () => (document.visibilityState === "hidden" ? pause() : resume());

  return {
    start: () => {
      // Tests and non-window hosts have no frames to count.
      if (typeof requestAnimationFrame !== "function") return;
      state = emptyFrameRate(performance.now());
      document.addEventListener("visibilitychange", onVisibility);
      resume();
    },
    stop: () => {
      if (typeof requestAnimationFrame !== "function") return;
      document.removeEventListener("visibilitychange", onVisibility);
      pause();
      state = emptyFrameRate(performance.now());
      for (const listener of listeners) listener();
    },
    getBuckets: () => state.buckets,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

export type FrameRateCounter = ReturnType<typeof createFrameRateCounter>;
