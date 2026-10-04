import { describe, expect, test } from "bun:test";
import { slowFrameReportSchema } from "pstdio-api-contracts/performance-diagnostics";
import { sanitizeScriptSource, toSlowFrame } from "./slow-frame-attribution";

const origin = "http://127.0.0.1:43123";

describe("slow frame attribution", () => {
  test("keeps only the file name of app scripts", () => {
    expect(sanitizeScriptSource(`${origin}/assets/index-4f2a.js?token=secret#x`, origin)).toBe("index-4f2a.js");
  });

  test("hides extension webview capabilities, other origins, and inline sources", () => {
    expect(
      sanitizeScriptSource(`${origin}/v1/extensions/webviews/capability/installed/lab/assets/module.js`, origin),
    ).toBe("extension webview");
    expect(sanitizeScriptSource("https://cdn.example.com/private/path.js?key=1", origin)).toBe("external script");
    expect(sanitizeScriptSource("blob:http://127.0.0.1:43123/5f1c", origin)).toBe("external script");
    expect(sanitizeScriptSource("", origin)).toBeNull();
  });

  test("turns a long animation frame into a bounded, URL-free sample", () => {
    const scripts = Array.from({ length: 7 }, (_, index) => ({
      duration: index * 10,
      invoker: index === 6 ? `${origin}/assets/chat.js?session=abc` : `BUTTON#send.onclick ${origin}/x?y=1`,
      invokerType: index === 6 ? "classic-script" : "event-listener",
      sourceFunctionName: "x".repeat(300),
      sourceURL: `${origin}/assets/chat-1c9e.js?token=1`,
    }));
    const frame = toSlowFrame(
      { startTime: 500, duration: 182.4, blockingDuration: 132.2, scripts },
      { timeOrigin: Date.parse("2026-10-02T12:00:00.000Z"), origin },
    );

    expect(frame.startedAt).toBe("2026-10-02T12:00:00.500Z");
    expect(frame.durationMs).toBe(182);
    expect(frame.blockingDurationMs).toBe(132);
    expect(frame.scripts.map((script) => script.durationMs)).toEqual([60, 50, 40, 30, 20]);
    expect(frame.scripts[0]).toMatchObject({
      invokerType: "classic-script",
      invoker: "chat.js",
      source: "chat-1c9e.js",
    });
    expect(frame.scripts[1]?.invoker).toBe("BUTTON#send.onclick [url]");
    expect(JSON.stringify(frame)).not.toContain("token");
    expect(slowFrameReportSchema.safeParse({ source: "long-animation-frame", frames: [frame] }).success).toBe(true);
  });

  test("records long tasks without script attribution the browser does not provide", () => {
    expect(toSlowFrame({ startTime: 0, duration: 75 }, { timeOrigin: 0, origin })).toEqual({
      startedAt: "1970-01-01T00:00:00.000Z",
      durationMs: 75,
      blockingDurationMs: null,
      scripts: [],
    });
  });
});
