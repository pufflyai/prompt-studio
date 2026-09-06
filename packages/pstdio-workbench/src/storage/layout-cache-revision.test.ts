import { expect, test } from "bun:test";
import type { PageLocation } from "@pstdio/sdk/extensions";
import { createDefaultWorkbenchLayout } from "../core";
import { createLocalStorageWorkbenchPersistence, workbenchStoragePersistenceKey } from "./local-storage-persistence";

test("invalidates the changed layout cache while preserving locations and independent preferences", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const persistence = createLocalStorageWorkbenchPersistence({ namespace: "revision", scope: "project/one", storage });
  const location: PageLocation = {
    page: { kind: "page", extensionId: "acme.notes", id: "note" },
    resource: { type: "note", id: "one", label: "First note" },
  };
  const trees = { statesByTreeId: { notes: { expandedNodeIds: ["one"], expandedSectionIds: [] } } };
  const menus = { openByMenuId: { inspector: true } };
  persistence.pageLocationPersistence.save("one", location);
  persistence.treePersistence.setTreeStates(trees);
  persistence.panelMenuStatePersistence.setMenuStates(menus);
  persistence.sidePanelPersistence.setMode("floating");
  storage.setItem(
    workbenchStoragePersistenceKey("revision", "layout", "project/one"),
    JSON.stringify({
      version: 3,
      layout: createDefaultWorkbenchLayout(),
    }),
  );

  expect(persistence.layoutPersistence.getLayout("project/one")).toBeUndefined();
  expect(persistence.pageLocationPersistence.load("one")).toEqual(location);
  expect(persistence.treePersistence.getTreeStates()).toEqual(trees);
  expect(persistence.panelMenuStatePersistence.getMenuStates()).toEqual(menus);
  expect(persistence.sidePanelPersistence.getMode()).toBe("floating");
  persistence.snapshotPersistence.dispose?.();
});
