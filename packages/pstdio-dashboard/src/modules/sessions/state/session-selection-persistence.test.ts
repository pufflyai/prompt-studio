import { describe, expect, test } from "bun:test";
import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";
import { createDashboardSessionSelectionPersistence } from "./session-selection-persistence";

const createStorage = (): WorkbenchStorageLike => {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
};

describe("dashboard session selection persistence", () => {
  test("keeps selected session ids isolated by project and clears drafts", () => {
    const persistence = createDashboardSessionSelectionPersistence({
      namespace: "test",
      storage: createStorage(),
    });

    persistence.setSelectedSessionId("project-a", "session-a");
    persistence.setSelectedSessionId("project-b", "session-b");
    persistence.setSelectedSessionId("project-b", undefined);

    expect(persistence.getSelectedSessionId("project-a")).toBe("session-a");
    expect(persistence.getSelectedSessionId("project-b")).toBeUndefined();
  });
});
