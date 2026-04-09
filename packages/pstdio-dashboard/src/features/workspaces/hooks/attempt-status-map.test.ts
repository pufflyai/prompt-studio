import { describe, expect, test } from "bun:test";
import { buildAttemptStatusMap } from "./attempt-status-map";

describe("buildAttemptStatusMap", () => {
  test("returns an empty map when rows are missing", () => {
    expect(buildAttemptStatusMap(undefined).size).toBe(0);
  });

  test("maps name, color, and optional description", () => {
    const map = buildAttemptStatusMap([
      {
        id: "status-1",
        name: "review-ready",
        color: "green",
        description: "Ready for human review",
      },
    ]);

    expect(map.get("status-1")).toEqual({
      name: "review-ready",
      color: "green",
      description: "Ready for human review",
    });
  });
});
