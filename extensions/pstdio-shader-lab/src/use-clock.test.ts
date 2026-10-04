import { expect, test } from "bun:test";
import { createClock } from "./use-clock";

test("playback owns one frame loop and cancels it on pause", () => {
  const pending = new Map<number, FrameRequestCallback>();
  const originalRequest = globalThis.requestAnimationFrame;
  const originalCancel = globalThis.cancelAnimationFrame;
  let next = 0;
  globalThis.requestAnimationFrame = (callback) => {
    pending.set(++next, callback);
    return next;
  };
  globalThis.cancelAnimationFrame = (id) => {
    pending.delete(id);
  };
  try {
    const clock = createClock();
    clock.play();
    clock.play();
    expect(pending.size).toBe(1);
    clock.pause();
    expect(pending.size).toBe(0);
  } finally {
    globalThis.requestAnimationFrame = originalRequest;
    globalThis.cancelAnimationFrame = originalCancel;
  }
});
