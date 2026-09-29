import { expect, test } from "bun:test";
import { workbenchPages } from "@pstdio/sdk/extensions";
import { createLocalStoragePageLocationPersistence } from "../../../storage/local-storage-persistence";
import { createWorkbench } from "../../workbench-core";

const values = new Map<string, string>();
const storage = {
  get length() {
    return values.size;
  },
  key: (index: number) => [...values.keys()][index] ?? null,
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => {
    values.set(key, value);
  },
  removeItem: (key: string) => {
    values.delete(key);
  },
};
const create = () => {
  const wb = createWorkbench({
    pageLocationPersistence: createLocalStoragePageLocationPersistence({ namespace: "levels", storage }),
  });
  wb.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  for (const id of ["start", "workspaces", "sessions", "session"]) {
    wb.views.registerView({ id, title: id, body: { kind: "react", render: () => null } });
    wb.pages.registerPage({
      id,
      ref: workbenchPages[id as "start"],
      path: id === "start" ? "" : id,
      title: id,
      modeId: "project",
      ...(id === "session" ? { parentId: "sessions" } : {}),
      main: { kind: "view", view: { kind: "view", id }, cardinality: "one" },
      slots: [],
    });
  }
  wb.navigationTrees.registerContribution({
    id: "sessions",
    owner: { kind: "page", id: "sessions", extensionId: "pstdio" },
    sourceExtensionId: "pstdio",
    declarationIndex: 0,
    getSections: () => [],
  });
  return wb;
};
test("remembers committed locations by level, replaces entries, restores them, and isolates projects", () => {
  values.clear();
  const wb = create();
  wb.pageLocations.boot("one");
  wb.pageLocations.navigate({ kind: "page", page: workbenchPages.workspaces });
  wb.pageLocations.navigate({ kind: "page", page: workbenchPages.sessions });
  wb.pageLocations.navigate({ kind: "page", page: workbenchPages.session });
  expect(wb.pageLocations.getLevelLocation("project")?.page).toEqual(workbenchPages.workspaces);
  expect(wb.pageLocations.getLevelLocation("sessions")?.page).toEqual(workbenchPages.session);
  const restored = create();
  restored.pageLocations.boot("one");
  expect(restored.pageLocations.getLevelLocation("project")?.page).toEqual(workbenchPages.workspaces);
  expect(restored.pageLocations.getLevelLocation("sessions")?.page).toEqual(workbenchPages.session);
  restored.pageLocations.switchProject("two");
  expect(restored.pageLocations.getLevelLocation("sessions")).toBeUndefined();
  expect(restored.pageLocations.getLevelLocation("project")?.page).toEqual(workbenchPages.start);
  restored.pageLocations.switchProject("one");
  expect(restored.pageLocations.getLevelLocation("project")?.page).toEqual(workbenchPages.workspaces);
});
