import { describe, expect, test } from "bun:test";
import { PERFORMANCE_LIMITS, slowFrameReportSchema } from "./performance-diagnostics";

const frame = {
  startedAt: "2026-10-02T12:04:31.000Z",
  durationMs: 182,
  blockingDurationMs: 132,
  scripts: [
    {
      invokerType: "resolve-promise",
      invoker: "Promise.then",
      source: "index-4f2a.js",
      functionName: "flush",
      durationMs: 160,
    },
  ],
};

describe("slow frame reports", () => {
  test("accept bounded frames with sanitized script attribution", () => {
    expect(slowFrameReportSchema.parse({ source: "long-animation-frame", frames: [frame] })).toEqual({
      source: "long-animation-frame",
      frames: [frame],
    });
  });

  test("reject reports that exceed the frame, script, or text limits", () => {
    const tooManyFrames = Array.from({ length: PERFORMANCE_LIMITS.framesPerReport + 1 }, () => frame);
    const tooManyScripts = {
      ...frame,
      scripts: Array.from({ length: PERFORMANCE_LIMITS.scriptsPerFrame + 1 }, () => frame.scripts[0]),
    };
    const longText = { ...frame, scripts: [{ ...frame.scripts[0], invoker: "x".repeat(PERFORMANCE_LIMITS.text + 1) }] };

    for (const frames of [tooManyFrames, [tooManyScripts], [longText]]) {
      expect(slowFrameReportSchema.safeParse({ source: "longtask", frames }).success).toBe(false);
    }
  });

  test("reject unknown fields so raw entries cannot pass through", () => {
    expect(
      slowFrameReportSchema.safeParse({ source: "longtask", frames: [{ ...frame, sourceURL: "https://x/?token=1" }] })
        .success,
    ).toBe(false);
    expect(
      slowFrameReportSchema.safeParse({ source: "longtask", frames: [{ ...frame, durationMs: -1 }] }).success,
    ).toBe(false);
  });
});
