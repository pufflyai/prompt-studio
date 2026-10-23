import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquireTimingWindow, assertTimingWindow, releaseTimingWindow } from "./timing-window";

test("one machine window needs explicit peer acknowledgements and only its owner can release it", () => {
  const root = mkdtempSync(join(tmpdir(), "timing-window-test-"));
  const path = join(root, "window");
  const input = {
    sessionId: "owner",
    requiredPeers: ["peer-a", "peer-b"],
    acknowledgements: [{ sessionId: "peer-a", evidence: "request-1: confirmed paused" }],
    purpose: "unit-test",
  };
  try {
    expect(() => acquireTimingWindow(path, input)).toThrow("peer-b");
    const lease = acquireTimingWindow(path, {
      ...input,
      acknowledgements: [...input.acknowledgements, { sessionId: "peer-b", evidence: "request-2: confirmed paused" }],
    });
    expect(assertTimingWindow(path, "owner", lease.token).sessionId).toBe("owner");
    expect(() => acquireTimingWindow(path, input)).toThrow();
    expect(() => releaseTimingWindow(path, "other", lease.token)).toThrow("owner");
    expect(() => assertTimingWindow(path, "owner", "wrong-token")).toThrow("token");
    releaseTimingWindow(path, "owner", lease.token);
    expect(() => assertTimingWindow(path, "owner", lease.token)).toThrow();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
