import { describe, expect, test } from "bun:test";
import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";
import { createDesktopWorkbenchStorage } from "./desktop-workbench-storage";

const createStorage = () => {
  const values = new Map<string, string>();
  const storage: WorkbenchStorageLike = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
  return storage;
};

describe("createDesktopWorkbenchStorage", () => {
  test("hydrates a synchronous storage adapter and forwards later changes", async () => {
    const changes: Array<[string, string | null]> = [];
    const storage = await createDesktopWorkbenchStorage({
      getWorkbenchState: async () => ({ pageLocations: {}, selectedProjectId: "project-one" }),
      setPageLocation: async (projectId, value) => {
        changes.push([`page-location:${projectId}`, value]);
      },
      setSelectedProjectId: async (value) => {
        changes.push(["selected-project", value]);
      },
    });

    expect(storage?.getItem("dashboard-wb2:selected-project:global")).toBe("project-one");
    storage?.setItem("dashboard-wb2:page-location:project-one", "workspace-one");
    storage?.removeItem?.("dashboard-wb2:selected-project:global");

    expect(storage?.getItem("dashboard-wb2:selected-project:global")).toBeNull();
    expect(changes).toEqual([
      ["page-location:project-one", "workspace-one"],
      ["selected-project", null],
    ]);
  });

  test("leaves browser persistence unchanged outside desktop", async () => {
    expect(await createDesktopWorkbenchStorage(undefined)).toBeUndefined();
  });

  test("keeps session drafts in browser storage instead of sending them to Electron", async () => {
    const changes: Array<[string, string | null]> = [];
    const browserStorage = createStorage();
    const storage = await createDesktopWorkbenchStorage(
      {
        getWorkbenchState: async () => ({ pageLocations: {} }),
        setPageLocation: async (projectId, value) => {
          changes.push([`page-location:${projectId}`, value]);
        },
        setSelectedProjectId: async (value) => {
          changes.push(["selected-project", value]);
        },
      },
      browserStorage,
    );

    storage?.setItem("dashboard-wb2:session-drafts:project-one", '{"session-one":"private draft"}');

    expect(browserStorage.getItem("dashboard-wb2:session-drafts:project-one")).toBe('{"session-one":"private draft"}');
    expect(changes).toEqual([]);
  });
});
