import { describe, expect, test } from "bun:test";
import { emptyFrameRate, FRAME_RATE_SECONDS, recordFrame } from "./frame-rate";

const framesAt = (times: number[]) => times.reduce(recordFrame, emptyFrameRate(0));

describe("frame rate", () => {
  test("closes one bucket per second with the frames drawn in it", () => {
    const state = framesAt([0, 16, 33, 1000, 1016, 2001]);
    expect(state.buckets).toEqual([3, 2]);
  });

  test("records missed seconds as zero frames", () => {
    const state = framesAt([10, 20, 3500]);
    expect(state.buckets).toEqual([2, 0, 0]);
  });

  test("keeps only the last 30 seconds", () => {
    const times = Array.from({ length: 40 }, (_, second) => second * 1000);
    expect(framesAt(times).buckets).toHaveLength(FRAME_RATE_SECONDS);
  });
});
