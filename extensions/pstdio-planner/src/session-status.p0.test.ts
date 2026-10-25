import { describe, expect, test } from "bun:test";
import { isLiveSessionStatus } from "./session-status";

describe("isLiveSessionStatus", () => {
  test("classifies sessions that can still make progress", () => {
    expect(["queued", "in_progress", "awaiting_input"].every(isLiveSessionStatus)).toBe(true);
    expect(["completed", "failed", "cancelled", "disconnected"].some(isLiveSessionStatus)).toBe(false);
  });
});
