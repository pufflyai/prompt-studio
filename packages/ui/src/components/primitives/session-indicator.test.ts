import { describe, expect, it } from "bun:test";
import { CircleDot, CircleStop, ClockAlert, LoaderCircle } from "lucide-react";
import {
  resolveSessionIndicatorColor,
  resolveSessionIndicatorIcon,
  sessionCompletionStatuses,
} from "@/components/primitives/session-indicator";

describe("session indicator", () => {
  it("lists every supported session state", () => {
    expect(sessionCompletionStatuses).toEqual([
      "in_progress",
      "awaiting_input",
      "queued",
      "completed",
      "failed",
      "cancelled",
      "disconnected",
    ]);
  });

  it("renders active sessions as their own state", () => {
    expect(resolveSessionIndicatorIcon("in_progress")).toBe(LoaderCircle);
    expect(resolveSessionIndicatorColor("in_progress")).toBe("fg.info");
  });

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
    expect(resolveSessionIndicatorColor("awaiting_input")).toBe("fg.warning");
  });
});
