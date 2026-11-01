import { expect, test } from "bun:test";
import { nextPlaybackTime, readParameters } from "./model";

test("only advertised primitive controls enter the Parameters menu", () => {
  expect(
    readParameters({
      controls: { amount: { type: "number", min: 0, max: 1 }, unsupported: { type: "function" } },
      values: { amount: 0.5, callback: () => {} },
    }),
  ).toMatchObject({ controls: { amount: { type: "number" } }, values: { amount: 0.5 } });
  expect(readParameters(undefined)).toEqual({ controls: {}, values: {} });
});
test("playback uses the selected range, wraps only when looping, and clamps its end", () => {
  expect(nextPlaybackTime(3.9, 0.3, 2, 4, true)).toBeCloseTo(2.2);
  expect(nextPlaybackTime(3.9, 0.3, 2, 4, false)).toBe(4);
  expect(nextPlaybackTime(0, 0.2, 2, 4, false)).toBe(2.2);
});
