import { expect, test } from "bun:test";
import { type PageRef, workbenchPages } from "@pstdio/sdk/extensions";
import { createWorkbench } from "../../workbench-core";

const home: PageRef = { kind: "page", extensionId: "example", id: "home" };
const fixture = () => {
  const core = createWorkbench({ startPage: home });
  core.modes.registerMode({ id: "project", activate() {} });
  const register = (id: string, ref: PageRef = { ...home, id }, parentId?: string) =>
    core.pages.registerPage({
      id,
      ref,
      path: id,
      modeId: "project",
      parentId,
      main: { kind: "panels" },
      slots: [],
    });
  return { core, register };
};

test("legacy Start navigation uses an explicit default through direct and remembered parents", () => {
  const { core, register } = fixture();
  register("home", home);
  register("detail", undefined, "start");
  core.pageLocations.setProject("p1");
  expect(core.pageLocations.navigate({ kind: "page", page: workbenchPages.start }).ok).toBe(true);
  expect(core.pages.store.getState().location?.page).toEqual(home);
  expect(core.pageLocations.navigate({ kind: "page", page: { ...home, id: "detail" } }).ok).toBe(true);
  expect(core.pages.store.getState().location?.parent?.page).toEqual(home);
  expect(
    core.pageLocations.replay({ page: { ...home, id: "detail" }, parent: { page: workbenchPages.start } }).ok,
  ).toBe(true);
  expect(core.pages.store.getState().location?.parent?.page).toEqual(home);
});

test("an embedded workbench's registered Start remains its own destination", () => {
  const { core, register } = fixture();
  register("home", home);
  register("start", workbenchPages.start);
  core.pageLocations.setProject("p1");
  expect(core.pageLocations.navigate({ kind: "page", page: workbenchPages.start }).ok).toBe(true);
  expect(core.pages.store.getState().location?.page).toEqual(workbenchPages.start);
});

test("removing the configured default keeps the mode empty and other pages accessible", () => {
  const { core, register } = fixture();
  const owner = register("home", home);
  register("other");
  expect(core.pageLocations.boot("p1").ok).toBe(true);
  owner.dispose();
  expect(core.pages.store.getState().location).toBeUndefined();
  expect(core.modes.getActiveModeId()).toBe("project");
  expect(core.pages.getContent()).toBeUndefined();
  expect(core.pageLocations.navigate({ kind: "page", page: { ...home, id: "other" } }).ok).toBe(true);
});
