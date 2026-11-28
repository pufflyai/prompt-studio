import { describe, expect, test } from "bun:test";
import { createDesktopWorkbenchStorage, type DesktopWorkbenchStorageBridge } from "./desktop-workbench-storage";

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
    const storage = await createDesktopWorkbenchStorage(bridge);

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

  test("sends unsent chat drafts to Electron so they survive a restart", async () => {
    const { bridge, changes } = createBridge();
    const storage = await createDesktopWorkbenchStorage(bridge);

    storage?.setItem("pstdio-workbench:chat-draft:session-one", '{"text":"half-written"}');

    expect(changes).toEqual([["pstdio-workbench:chat-draft:session-one", '{"text":"half-written"}']]);
  });
});
