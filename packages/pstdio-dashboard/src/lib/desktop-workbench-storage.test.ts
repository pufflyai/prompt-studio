import { describe, expect, test } from "bun:test";
import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";
import { createDesktopWorkbenchStorage, type DesktopWorkbenchStorageBridge } from "./desktop-workbench-storage";

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

const createBridge = (values: Record<string, string> = {}) => {
  const changes: Array<[string, string | null]> = [];
  const bridge: DesktopWorkbenchStorageBridge = {
    getWorkbenchState: async () => ({ values }),
    setWorkbenchItem: async (key, value) => {
      changes.push([key, value]);
    },
  };
  return { bridge, changes };
};

describe("createDesktopWorkbenchStorage", () => {
  test("hydrates saved workbench values and forwards every later change", async () => {
    const { bridge, changes } = createBridge({ "dashboard-wb2:selected-project:global": "project-one" });
    const storage = await createDesktopWorkbenchStorage(bridge, createStorage());

    expect(storage?.getItem("dashboard-wb2:selected-project:global")).toBe("project-one");
    storage?.setItem("dashboard-wb2:layout:project/project-one", '{"version":5}');
    storage?.setItem("pstdio/ui/kanban-renderer/tickets", '{"state":{}}');
    storage?.removeItem?.("dashboard-wb2:selected-project:global");

    expect(storage?.getItem("dashboard-wb2:layout:project/project-one")).toBe('{"version":5}');
    expect(storage?.getItem("dashboard-wb2:selected-project:global")).toBeNull();
    expect(changes).toEqual([
      ["dashboard-wb2:layout:project/project-one", '{"version":5}'],
      ["pstdio/ui/kanban-renderer/tickets", '{"state":{}}'],
      ["dashboard-wb2:selected-project:global", null],
    ]);
  });

  test("leaves browser persistence unchanged outside desktop", async () => {
    expect(await createDesktopWorkbenchStorage(undefined)).toBeUndefined();
  });

  test("keeps session drafts in browser storage instead of sending them to Electron", async () => {
    const { bridge, changes } = createBridge();
    const browserStorage = createStorage();
    const storage = await createDesktopWorkbenchStorage(bridge, browserStorage);

    storage?.setItem("dashboard-wb2:session-drafts:project-one", '{"session-one":"private draft"}');

    expect(browserStorage.getItem("dashboard-wb2:session-drafts:project-one")).toBe('{"session-one":"private draft"}');
    expect(changes).toEqual([]);
  });
});
