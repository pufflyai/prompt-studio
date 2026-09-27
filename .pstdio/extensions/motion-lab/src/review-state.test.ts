import { describe, expect, test } from "bun:test";
import { applyReviewChange, initialState, loopBounds, playbackPosition } from "./review-state";

describe("review playback", () => {
  test("keeps loop bounds inside the study with at least two frames", () => {
    const state = initialState("tabs");
    expect(loopBounds({ ...state, loopRange: [-20, 900] })).toEqual({ start: 0, end: 419, max: 419 });
    expect(loopBounds({ ...state, loopRange: [900, 10] })).toEqual({ start: 418, end: 419, max: 419 });
  });

  test("includes the loop end before wrapping to its start", () => {
    const state = {
      ...initialState("tabs"),
      loop: true,
      loopRange: [60, 120] as [number, number],
      playing: true,
      frame: 120,
      startedAt: 1000,
    };
    expect(playbackPosition(state, 1000)).toEqual({ frame: 120, playing: true });
    expect(playbackPosition(state, 1017)).toEqual({ frame: 60, playing: true });
    expect(playbackPosition({ ...state, frame: 0 }, 1000)).toEqual({ frame: 60, playing: true });
  });

  test("stops at the final frame without looping", () => {
    const state = { ...initialState("tabs"), playing: true, frame: 418, startedAt: 1000 };
    expect(playbackPosition(state, 1017)).toEqual({ frame: 419, playing: false });
    expect(playbackPosition(state, 5000)).toEqual({ frame: 419, playing: false });
  });

  test("changes speed from the current position without jumping", () => {
    const state = { ...initialState("tabs"), playing: true, frame: 60, startedAt: 1000 };
    const changed = applyReviewChange(state, { rate: 2 }, 2000);
    expect(changed.frame).toBe(120);
    expect(playbackPosition(changed, 2500)).toEqual({ frame: 180, playing: true });
  });

  test("pauses at the elapsed frame and keeps the review's study identity", () => {
    const state = { ...initialState("tabs"), playing: true, frame: 60, startedAt: 1000 };
    const changed = applyReviewChange(state, { playing: false, settings: { theme: "dark", study: "panels" } }, 2000);
    expect(playbackPosition(changed, 5000)).toEqual({ frame: 120, playing: false });
    expect(changed.settings.study).toBe("tabs");
    expect(changed.settings.theme).toBe("dark");
  });
});
