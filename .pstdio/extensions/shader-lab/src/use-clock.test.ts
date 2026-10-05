import { expect, spyOn, test } from "bun:test";
import { createClock } from "./use-clock";

// Control both browser queues so the test can check that frames wait for a timer.
const browserLoop = () => {
  let now = 0;
  let id = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const frames = new Map<number, FrameRequestCallback>();
  const originals = {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  };
  const performanceNow = spyOn(performance, "now").mockImplementation(() => now);
  globalThis.setTimeout = ((callback: () => void, delay: number) => {
    timers.set(++id, { at: now + delay, callback });
    return id;
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((key: number) => timers.delete(key)) as typeof clearTimeout;
  globalThis.requestAnimationFrame = (callback) => {
    frames.set(++id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = (key) => {
    frames.delete(key);
  };
  return {
    timers,
    frames,
    advance(milliseconds: number) {
      now += milliseconds;
      for (const [key, timer] of [...timers]) {
        if (timer.at > now) continue;
        timers.delete(key);
        timer.callback();
      }
      for (const [key, callback] of [...frames]) {
        frames.delete(key);
        callback(now);
      }
    },
    restore() {
      Object.assign(globalThis, originals);
      performanceNow.mockRestore();
    },
  };
};

test("playback waits between frames and notifies at most every 33 ms", () => {
  const loop = browserLoop();
  try {
    const clock = createClock();
    const ticks: number[] = [];
    clock.subscribe(() => ticks.push(performance.now()));
    clock.play();
    clock.play();
    expect(loop.frames.size).toBe(0);
    expect(loop.timers.size).toBe(1);
    for (let i = 0; i < 120; i++) {
      loop.advance(1000 / 120);
      expect(loop.frames.size).toBe(0);
      expect(loop.timers.size).toBe(1);
    }
    expect(ticks.length).toBeGreaterThan(20);
    expect(ticks.length).toBeLessThanOrEqual(30);
    expect(ticks.slice(1).every((time, i) => time - ticks[i] >= 33)).toBe(true);
    clock.pause();
    expect(loop.timers.size).toBe(0);
    expect(loop.frames.size).toBe(0);
  } finally {
    loop.restore();
  }
});

test("pause captures exact time and resume excludes time spent paused", () => {
  const loop = browserLoop();
  try {
    const clock = createClock();
    clock.play();
    loop.advance(10);
    expect(clock.time()).toBeCloseTo(0.01);
    clock.pause();
    loop.advance(1000);
    expect(clock.time()).toBeCloseTo(0.01);
    clock.play();
    loop.advance(20);
    expect(clock.time()).toBeCloseTo(0.03);
    clock.pause();
  } finally {
    loop.restore();
  }
});

test("pausing from a listener does not schedule another tick", () => {
  const loop = browserLoop();
  try {
    const clock = createClock();
    clock.subscribe(() => clock.pause());
    clock.play();
    loop.advance(40);
    expect(loop.timers.size).toBe(0);
    expect(loop.frames.size).toBe(0);
  } finally {
    loop.restore();
  }
});

test("elapsed-only previews request one tick per second and script listeners use the capped cadence", () => {
  const loop = browserLoop();
  try {
    const clock = createClock();
    let elapsedTicks = 0;
    let motionTicks = 0;
    clock.subscribeElapsed(() => elapsedTicks++);
    clock.play();
    loop.advance(40);
    expect(elapsedTicks).toBe(0);
    loop.advance(960);
    expect(elapsedTicks).toBe(1);
    const unsubscribe = clock.subscribe(() => motionTicks++);
    loop.advance(34);
    expect(motionTicks).toBe(1);
    unsubscribe();
    loop.advance(100);
    expect(motionTicks).toBe(1);
    expect(loop.frames.size).toBe(0);
    clock.pause();
    expect(loop.timers.size).toBe(0);
  } finally {
    loop.restore();
  }
});

test("subscription changes during a tick leave one queue that pause cancels", () => {
  const loop = browserLoop();
  try {
    const clock = createClock();
    const unsubscribe = clock.subscribe(() => unsubscribe());
    clock.play();
    loop.advance(34);
    expect(loop.timers.size).toBe(1);
    clock.pause();
    expect(loop.timers.size).toBe(0);
    loop.advance(1000);
    expect(loop.frames.size).toBe(0);
    expect(loop.timers.size).toBe(0);
  } finally {
    loop.restore();
  }
});
