import { describe, expect, test } from "bun:test";
import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";
import { createDashboardSessionDraftPersistence } from "./session-draft-persistence";
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

const createProjectSelection = () => {
  let projectId: string | undefined = "project-a";
  return {
    getSelectedProjectId: () => projectId,
    select: (nextProjectId: string) => {
      projectId = nextProjectId;
    },
  };
};

describe("dashboard session persistence", () => {
  test("isolates the selected session by project and clears only the active project", () => {
    const storage = createStorage();
    const projectSelection = createProjectSelection();
    const persistence = createDashboardSessionSelectionPersistence({
      namespace: "dashboard-test",
      storage,
      projectSelection,
    });

    persistence.setSelectedSessionId("session-a");
    projectSelection.select("project-b");
    expect(persistence.getSelectedSessionId()).toBeUndefined();

    persistence.setSelectedSessionId("session-b");
    persistence.setSelectedSessionId(undefined);
    projectSelection.select("project-a");

    expect(persistence.getSelectedSessionId()).toBe("session-a");
  });

  test("isolates drafts by project and removes an explicitly cleared draft", () => {
    const storage = createStorage();
    const projectSelection = createProjectSelection();
    const persistence = createDashboardSessionDraftPersistence({
      namespace: "dashboard-test",
      storage,
      projectSelection,
    });

    persistence.setDraft("session-1", "Project A draft");
    projectSelection.select("project-b");
    expect(persistence.getDraft("session-1")).toBe("");

    persistence.setDraft("session-1", "Project B draft");
    persistence.setDraft("session-1", "");
    projectSelection.select("project-a");

    expect(persistence.getDraft("session-1")).toBe("Project A draft");
  });
});
