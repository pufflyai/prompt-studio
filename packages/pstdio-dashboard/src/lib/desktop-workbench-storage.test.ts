import { describe, expect, test } from "bun:test";
import { createDesktopWorkbenchStorage } from "./desktop-workbench-storage";

describe("createDesktopWorkbenchStorage", () => {
  test("hydrates a synchronous storage adapter and forwards later changes", async () => {
    const changes: Array<[string, string | null]> = [];
    const storage = await createDesktopWorkbenchStorage({
      getWorkbenchState: async () => ({ "dashboard-wb:selected-project:global": "project-one" }),
      setWorkbenchStateItem: async (key, value) => {
        changes.push([key, value]);
      },
    });

    expect(storage?.getItem("dashboard-wb:selected-project:global")).toBe("project-one");
    storage?.setItem("dashboard-wb:last-resource:project-one", "workspace-one");
    storage?.removeItem?.("dashboard-wb:selected-project:global");

    expect(storage?.getItem("dashboard-wb:selected-project:global")).toBeNull();
    expect(changes).toEqual([
      ["dashboard-wb:last-resource:project-one", "workspace-one"],
      ["dashboard-wb:selected-project:global", null],
    ]);
  });

  test("leaves browser persistence unchanged outside desktop", async () => {
    expect(await createDesktopWorkbenchStorage(undefined)).toBeUndefined();
  });
});
