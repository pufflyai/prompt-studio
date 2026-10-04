import { useSyncExternalStore } from "react";

export type Clock = ReturnType<typeof createClock>;

// Seconds of playback, advanced every animation frame. Pausing keeps the current time.
// Shader DOM updates subscribe directly; React only reads whole elapsed seconds.
export const createClock = () => {
  let time = 0;
  let frame = 0;
  let playing = false;
  const listeners = new Set<() => void>();
  return {
    play() {
      if (playing) return;
      playing = true;
      const startedAt = performance.now() - time * 1000;
      const tick = (now: number) => {
        time = (now - startedAt) / 1000;
        for (const listener of listeners) listener();
        if (playing) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    },
    pause() {
      playing = false;
      cancelAnimationFrame(frame);
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    time: () => time,
  };
};

// Re-renders once per second instead of every frame.
export const useClockSeconds = (clock: Clock) => useSyncExternalStore(clock.subscribe, () => Math.floor(clock.time()));
