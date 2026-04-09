import { describe, expect, test } from "bun:test";
import { buildWorkspaceStatusIndicatorTooltip } from "./workspace-status-indicator";

describe("buildWorkspaceStatusIndicatorTooltip", () => {
  test("returns null when status is missing", () => {
    expect(buildWorkspaceStatusIndicatorTooltip(undefined)).toBeNull();
  });

  test("returns status name when description is absent", () => {
    expect(
      buildWorkspaceStatusIndicatorTooltip({
        name: "review-ready",
        color: "green",
      }),
    ).toBe("review-ready");
  });

  test("returns status name and description when present", () => {
    expect(
      buildWorkspaceStatusIndicatorTooltip({
        name: "blocked",
        color: "red",
        description: "Waiting on API keys",
      }),
    ).toBe("blocked: Waiting on API keys");
  });
});
