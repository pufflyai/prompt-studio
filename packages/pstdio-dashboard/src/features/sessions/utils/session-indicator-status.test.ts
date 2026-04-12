import { describe, expect, it } from "bun:test";
import { toSessionIndicatorStatus } from "./session-indicator-status";

describe("toSessionIndicatorStatus", () => {
  it("does not coerce cancelled sessions to failed", () => {
    expect(toSessionIndicatorStatus("cancelled")).toBeUndefined();
  });

  it("keeps non-cancelled statuses unchanged", () => {
    expect(toSessionIndicatorStatus("in_progress")).toBe("in_progress");
    expect(toSessionIndicatorStatus("awaiting_input")).toBe("awaiting_input");
    expect(toSessionIndicatorStatus("completed")).toBe("completed");
    expect(toSessionIndicatorStatus("failed")).toBe("failed");
  });

  it("returns undefined for null status", () => {
    expect(toSessionIndicatorStatus(null)).toBeUndefined();
  });
});
