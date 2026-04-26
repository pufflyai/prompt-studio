import { describe, expect, it } from "bun:test";
import { isStickyUserMessageCollapsible, shouldStopStickyUserMessageWheel } from "./chat-panel-sticky-user-message";
import type { SessionMessage } from "./message-types";

const statusColorPrompt = `const STATUS_INDICATOR_COLOR_BY_STATUS: Record<string, string> = {
  gray: "gray.400",
  red: "red.400",
  orange: "orange.400",
  yellow: "yellow.400",
  green: "green.400",
  teal: "teal.400",
  blue: "blue.400",
  cyan: "cyan.400",
  purple: "purple.400",
  pink: "pink.400",
};
instead of the above, use the correct status colors`;

describe("sticky user message", () => {
  it("collapses multiline user messages that render taller than the collapsed height", () => {
    const message: SessionMessage = {
      id: "status-color-prompt",
      role: "user",
      parts: [{ type: "text", text: statusColorPrompt }],
    };

    expect(isStickyUserMessageCollapsible(message)).toBe(true);
  });

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
