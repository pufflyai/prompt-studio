import { describe, expect, it } from "bun:test";
import { CircleDot, CircleStop, ClockAlert } from "lucide-react";
import { resolveSessionIndicatorColor, resolveSessionIndicatorIcon } from "./session-indicator";

describe("session indicator", () => {
  it("renders cancelled sessions as their own state", () => {
    expect(resolveSessionIndicatorIcon("cancelled")).toBe(CircleStop);
    expect(resolveSessionIndicatorColor("cancelled")).toBe("fg.warning");
  });

  it("renders queued sessions with an alert clock", () => {
    expect(resolveSessionIndicatorIcon("queued")).toBe(ClockAlert);
    expect(resolveSessionIndicatorColor("queued")).toBe("fg.info");
  });

  it("renders awaiting-input sessions as a distinct action-needed state", () => {
    expect(resolveSessionIndicatorIcon("awaiting_input")).toBe(CircleDot);
  });
});
