import { describe, expect, test } from "bun:test";
import type { WorkbenchStorageLike } from "pstdio-workbench/storage";
import { createDashboardLastResourcePersistence, dashboardLastResourceStorageKey } from "./last-resource-persistence";
import type { DashboardProjectSelectionPersistence } from "./project-selection-persistence";

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

const createProjectSelection = (
  initial?: string,
): Pick<DashboardProjectSelectionPersistence, "getSelectedProjectId"> & {
  set(projectId: string | undefined): void;
} => {
  let current = initial;
  return {
    getSelectedProjectId: () => current,
    set: (projectId) => {
      current = projectId;
    },
  };
};

const resource = { kind: "workspace", uri: "dashboard://workspace/one", label: "One" };

describe("createDashboardLastResourcePersistence", () => {
  test("scopes reads and writes by the currently selected project", () => {
    const storage = createStorage();
    const projectSelection = createProjectSelection("project-a");
    const persistence = createDashboardLastResourcePersistence({ namespace: "demo", storage, projectSelection });

    persistence.setLastResource(resource);
    expect(storage.getItem(dashboardLastResourceStorageKey("demo", "project-a"))).toBe(JSON.stringify(resource));
    expect(persistence.getLastResource()).toEqual(resource);

    projectSelection.set("project-b");
    expect(persistence.getLastResource()).toBeUndefined();

    projectSelection.set("project-a");
    expect(persistence.getLastResource()).toEqual(resource);
  });

  test("migrates the legacy global last resource for the selected project", () => {
    const storage = createStorage();
    const projectSelection = createProjectSelection("project-a");
    storage.setItem("demo:last-resource:global", JSON.stringify(resource));
    const persistence = createDashboardLastResourcePersistence({ namespace: "demo", storage, projectSelection });

    expect(persistence.getLastResource()).toEqual(resource);
    expect(storage.getItem(dashboardLastResourceStorageKey("demo", "project-a"))).toBe(JSON.stringify(resource));
    expect(storage.getItem("demo:last-resource:global")).toBeNull();
  });

  test("clearing a resource only affects the active project", () => {
    const storage = createStorage();
    const projectSelection = createProjectSelection("project-a");
    const persistence = createDashboardLastResourcePersistence({ namespace: "demo", storage, projectSelection });

    persistence.setLastResource(resource);
    projectSelection.set("project-b");
    persistence.setLastResource({ kind: "session", uri: "dashboard://session/two" });

    projectSelection.set("project-a");
    persistence.setLastResource(undefined);
    expect(storage.getItem(dashboardLastResourceStorageKey("demo", "project-a"))).toBeNull();

    projectSelection.set("project-b");
    expect(persistence.getLastResource()).toEqual({ kind: "session", uri: "dashboard://session/two" });
  });

  test("ignores reads and writes when no project is selected", () => {
    const storage = createStorage();
    const projectSelection = createProjectSelection(undefined);
    const persistence = createDashboardLastResourcePersistence({ namespace: "demo", storage, projectSelection });

    persistence.setLastResource(resource);
    expect(persistence.getLastResource()).toBeUndefined();
  });

  test("returns undefined for malformed persisted JSON", () => {
    const storage = createStorage();
    storage.setItem(dashboardLastResourceStorageKey("demo", "project-a"), "{");
    const persistence = createDashboardLastResourcePersistence({
      namespace: "demo",
      storage,
      projectSelection: createProjectSelection("project-a"),
    });

    expect(persistence.getLastResource()).toBeUndefined();
  });
});
