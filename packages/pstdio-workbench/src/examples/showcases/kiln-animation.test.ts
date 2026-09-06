import { describe, expect, it } from "bun:test";
import { sampleKilnTrack } from "./kiln-animation";

describe("Kiln animation sampling", () => {
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
