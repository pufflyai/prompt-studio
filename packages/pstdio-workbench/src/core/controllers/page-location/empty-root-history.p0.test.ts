import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";
import { createMemoryWorkbenchPageLocationBrowser } from "./page-location-memory";

const page = (id: string) => ({ kind: "page" as const, extensionId: "example", id });
const fixture = (reject = false) => {
  const browser = createMemoryWorkbenchPageLocationBrowser();
  let rejectWrites = false;
  const writes: string[] = [];
  const core = createWorkbench({
    startPage: page("home"),
    pageLocationBrowser: {
      ...browser,
      push(entry) {
        writes.push(entry.url);
        if (rejectWrites) throw new Error("History rejected");
        if (reject && new URL(entry.url, "http://workbench.local").pathname === "/projects/p1")
          throw new Error("History rejected");
        browser.push(entry);
      },
    },
  });
  core.modes.registerMode({ id: "project", activate() {} });
  for (const id of ["one", "two"]) {
    core.pages.registerPage({ id, ref: page(id), path: id, modeId: "project", main: { kind: "panels" }, slots: [] });
    core.navigationTrees.registerContribution({
      id,
      owner: page(id),
      sourceExtensionId: "example",
      declarationIndex: 0,
      getSections: () => [],
    });
  }
  core.pageLocations.setProject("p1");
  core.pageLocations.navigate({ kind: "page", page: page("one") });
  core.pageLocations.navigate({ kind: "page", page: page("two") });
  return {
    core,
    browser,
    writes,
    rejectBrowserWrites: () => {
      rejectWrites = true;
    },
  };
};

test("Back and Forward preserve tool locations and the empty project root", () => {
  const { core, browser } = fixture();
  core.pageLocations.navigateToRootLevel();
  expect(core.pages.store.getState().location).toBeUndefined();
  expect(browser.current().url).toBe("/projects/p1");
  expect(core.pageLocations.historyStore.getState().canGoBack).toBe(true);
  core.pageLocations.goBack();
  expect(core.pages.store.getState().location?.page).toEqual(page("two"));
  core.pageLocations.goBack();
  expect(core.pages.store.getState().location?.page).toEqual(page("one"));
  core.pageLocations.goForward();
  expect(core.pages.store.getState().location?.page).toEqual(page("two"));
  core.pageLocations.goForward();
  expect(core.pages.store.getState().location).toBeUndefined();
  expect(core.modes.getActiveModeId()).toBe("project");
});

test("a rejected browser commit leaves the tool and its history unchanged", () => {
  const { core, browser } = fixture(true);
  const state = core.pages.store.getState();
  const entry = browser.current();
  const history = core.pageLocations.historyStore.getState();
  expect(core.pageLocations.navigateToRootLevel()).toMatchObject({
    ok: false,
    diagnostic: { message: "History rejected" },
  });
  expect(core.pages.store.getState()).toBe(state);
  expect(browser.current()).toBe(entry);
  expect(core.pageLocations.historyStore.getState()).toEqual(history);
});

test("a failed commit to a valid saved root does not attempt the empty fallback", () => {
  const { core, browser, writes, rejectBrowserWrites } = fixture();
  core.pages.registerPage({
    id: "root",
    ref: page("root"),
    path: "root",
    modeId: "project",
    main: { kind: "panels" },
    slots: [],
  });
  core.pageLocations.navigate({ kind: "page", page: page("root") });
  core.pageLocations.navigate({ kind: "page", page: page("two") });
  const state = core.pages.store.getState();
  const entry = browser.current();
  const count = writes.length;
  rejectBrowserWrites();
  expect(core.pageLocations.navigateToRootLevel()).toMatchObject({ ok: false });
  expect(core.pages.store.getState()).toBe(state);
  expect(browser.current()).toBe(entry);
  expect(writes.length).toBe(count + 1);
});
