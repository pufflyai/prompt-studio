import { describe, expect, test } from "bun:test";
import { planner } from "./planner-client";

describe("Planner command references", () => {
  test("use canonical Planner command ids", () => {
    expect(planner.readStatuses.id).toBe("ticket-status-read");
    expect(planner.readTags.id).toBe("ticket-tag-read");
    expect(planner.runReview.id).toBe("run-review");

    for (const ref of Object.values(planner)) {
      expect(ref.extensionId).toBe("pstdio.pstdio-planner");
      expect(ref.id).toMatch(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
    }
  });
});
