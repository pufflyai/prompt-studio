import { describe, expect, it } from "bun:test";
import { shouldStopStickyUserMessageWheel } from "./chat-panel-sticky-user-message";

describe("sticky user message", () => {
  it("captures wheel events only while the expanded message can scroll in that direction", () => {
    const scrollableElement = {
      clientHeight: 100,
      scrollHeight: 300,
      scrollTop: 50,
    };

    expect(shouldStopStickyUserMessageWheel(scrollableElement, 20)).toBe(true);
    expect(shouldStopStickyUserMessageWheel(scrollableElement, -20)).toBe(true);

    expect(shouldStopStickyUserMessageWheel({ ...scrollableElement, scrollTop: 0 }, -20)).toBe(false);
    expect(shouldStopStickyUserMessageWheel({ ...scrollableElement, scrollTop: 200 }, 20)).toBe(false);
    expect(shouldStopStickyUserMessageWheel({ ...scrollableElement, scrollHeight: 100 }, 20)).toBe(false);
  });
});
