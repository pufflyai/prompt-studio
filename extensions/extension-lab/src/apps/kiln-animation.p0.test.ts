import { describe, expect, it } from "bun:test";
import { sampleKilnPlayback, sampleKilnTrack } from "./kiln-animation";

describe("Kiln animation sampling", () => {
  it("uses the saved start frame when a view opens late", () => {
    const state = { frame: 42, playing: true, playbackStartedAt: 1000 };
    expect(sampleKilnPlayback(state, 2000)).toBe(66);
    expect(sampleKilnPlayback(state, 3000)).toBe(90);
    expect(state.frame).toBe(42);
  });

  it("wraps and pauses at the chosen frame", () => {
    expect(sampleKilnPlayback({ frame: 110, playing: true, playbackStartedAt: 1000 }, 2000)).toBe(14);
    expect(sampleKilnPlayback({ frame: 66, playing: false, playbackStartedAt: 1000 }, 9000)).toBe(66);
    expect(sampleKilnPlayback({ frame: 66, playing: true, playbackStartedAt: 9000 }, 10000)).toBe(90);
  });
  const keys = [
    { frame: 1, value: 0 },
    { frame: 25, value: 90 },
    { frame: 49, value: 0 },
  ];

  it("reaches each keyframe and smoothly interpolates between them", () => {
    expect(sampleKilnTrack(keys, 1)).toBe(0);
    expect(sampleKilnTrack(keys, 25)).toBe(90);
    expect(sampleKilnTrack(keys, 13)).toBe(45);
    expect(sampleKilnTrack(keys, 37)).toBe(45);
  });

  it("holds the end values outside the keyed range", () => {
    expect(sampleKilnTrack(keys, 0)).toBe(0);
    expect(sampleKilnTrack(keys, 120)).toBe(0);
  });
});
