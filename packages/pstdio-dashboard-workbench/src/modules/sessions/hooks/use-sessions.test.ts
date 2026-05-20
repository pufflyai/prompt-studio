import { describe, expect, test } from "bun:test";
import { toVisibleSessions } from "./use-sessions";

describe("toVisibleSessions", () => {
  test("filters soft-deleted session rows", () => {
    expect(
      toVisibleSessions([
        { id: "session-1", title: "Active", status: "completed" },
        { id: "session-2", title: "Deleted", status: "completed", deleted_at: "2026-05-20T00:00:00.000Z" },
      ]),
    ).toEqual([{ id: "session-1", title: "Active", status: "completed", archived: false, updatedAt: undefined }]);
  });
});
