import { describe, expect, test } from "bun:test";
import { toVisibleExtensions } from "./use-extensions";

describe("toVisibleExtensions", () => {
  test("filters soft-deleted extension instances", () => {
    expect(
      toVisibleExtensions([
        { id: "extension-1", namespace: "active", enabled: true },
        { id: "extension-2", namespace: "deleted", enabled: true, deleted_at: "2026-05-20T00:00:00.000Z" },
      ]),
    ).toEqual([{ id: "extension-1", displayName: "active", namespace: "active", enabled: true }]);
  });
});
