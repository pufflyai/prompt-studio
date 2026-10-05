import { useSyncExternalStore } from "react";

export type Clock = ReturnType<typeof createClock>;

// Timers leave no frame callback pending between ticks, even on high-refresh displays.
export const createClock = () => {
  let elapsed = 0;
  let startedAt = 0;
  let frame = 0;
  let timer: ReturnType<typeof setTimeout>;
  let playing = false;
  const listeners = new Set<() => void>();
  const elapsedListeners = new Set<() => void>();
  const playbackListeners = new Set<() => void>();
  const time = () => elapsed + (playing ? (performance.now() - startedAt) / 1000 : 0);
  const subscribe = (collection: Set<() => void>, listener: () => void) => {
    collection.add(listener);
    return () => {
      collection.delete(listener);
    };
  };
  const schedule = () => {
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    timer = setTimeout(
      () => {
        frame = requestAnimationFrame(() => {
          for (const listener of listeners) listener();
          for (const listener of elapsedListeners) listener();
          if (playing) schedule();
        });
      },
      listeners.size ? 1000 / 30 : 1000,
    );
  };
  const reschedule = () => {
    if (!playing) return;
    schedule();
  };
  return {
    play() {
      if (playing) return;
      startedAt = performance.now();
      playing = true;
      schedule();
      for (const listener of playbackListeners) listener();
    },
    pause() {
      if (!playing) return;
      elapsed = time();
      playing = false;
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      for (const listener of playbackListeners) listener();
      for (const listener of listeners) listener();
      for (const listener of elapsedListeners) listener();
    },
    subscribe(listener: () => void) {
      const hadMotion = listeners.size > 0;
      const unsubscribe = subscribe(listeners, listener);
      if (!hadMotion) reschedule();
      return () => {
        unsubscribe();
        if (!listeners.size) reschedule();
      };
    },
    subscribeElapsed: (listener: () => void) => subscribe(elapsedListeners, listener),
    subscribePlayback: (listener: () => void) => subscribe(playbackListeners, listener),
    isPlaying: () => playing,
    time,
  };
};

export const useClockSeconds = (clock: Clock) =>
  useSyncExternalStore(clock.subscribeElapsed, () => Math.floor(clock.time()));
