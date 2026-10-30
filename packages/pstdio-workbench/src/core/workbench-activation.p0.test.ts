import { expect, test } from "bun:test";
import { createMemoryWorkbenchPageLocationBrowser } from "./controllers/page-location/page-location-memory";
import { createWorkbench } from "./workbench-core";

test("background navigation leaves the window history with the active workbench", async () => {
  const startPage = { extensionId: "pstdio", kind: "page", id: "start" } as const;
  const browser = createMemoryWorkbenchPageLocationBrowser();
  const visible = createWorkbench({ startPage, pageLocationBrowser: browser });
  const background = createWorkbench({ startPage, active: false, pageLocationBrowser: browser });
  visible.pages.registerPage({
    id: "start",
    ref: { extensionId: "pstdio", kind: "page", id: "start" },
    title: "Start",
    path: "",
    modeId: "project",
    main: { kind: "panels" },
    slots: [],
  });
  background.pages.registerPage({
    id: "start",
    ref: { extensionId: "pstdio", kind: "page", id: "start" },
    title: "Start",
    path: "",
    modeId: "project",
    main: { kind: "panels" },
    slots: [],
  });
  visible.modes.registerMode({ id: "project", activate: () => undefined });
  background.modes.registerMode({ id: "project", activate: () => undefined });
  expect(visible.pageLocations.boot("a").ok).toBe(true);
  const entry = browser.current();
  expect(background.pageLocations.boot("b").ok).toBe(true);
  expect(browser.current()).toEqual(entry);
  background.pageLocations.goBack();
  expect(browser.current()).toEqual(entry);
  visible.activation.setActive(false);
  background.activation.setActive(true);
  expect(browser.current().url).toContain("/projects/b");
  visible.activation.setActive(true);
  background.activation.setActive(false);
  expect(browser.current()).toEqual(entry);
  await Promise.all([visible.dispose(), background.dispose()]);
});

test("retained workbenches traverse their own history after several switches and background navigation", async () => {
  const browser = createMemoryWorkbenchPageLocationBrowser();
  const ref = (id: string) => ({ kind: "page", extensionId: "example", id }) as const;
  const open = (project: string, active: boolean) => {
    const workbench = createWorkbench({ active, startPage: ref("start"), pageLocationBrowser: browser });
    workbench.modes.registerMode({ id: "project", activate() {} });
    for (const id of ["start", "editor", "other"])
      workbench.pages.registerPage({
        id,
        ref: ref(id),
        path: id,
        modeId: "project",
        main: { kind: "panels" },
        slots: [],
      });
    expect(workbench.pageLocations.boot(project).ok).toBe(true);
    return workbench;
  };
  const a = open("a", true);
  const startUrl = browser.current().url;
  a.pageLocations.navigate({ kind: "page", page: ref("editor") });
  const b = open("b", false);
  a.activation.setActive(false);
  b.activation.setActive(true);
  b.pageLocations.navigate({ kind: "page", page: ref("editor") });
  a.activation.setActive(true);
  b.activation.setActive(false);
  a.pageLocations.goBack();
  expect(a.pages.store.getState().location?.page.id).toBe("start");
  expect(browser.current().url).toBe(startUrl);
  browser.back();
  expect(a.pages.store.getState().location?.page.id).toBe("start");
  browser.forward();
  expect(a.pages.store.getState().location?.page.id).toBe("editor");
  a.pageLocations.goBack();
  expect(b.pages.store.getState().location?.page.id).toBe("editor");
  a.pageLocations.goForward();
  expect(a.pages.store.getState().location?.page.id).toBe("editor");
  b.pageLocations.navigate({ kind: "page", page: ref("other") });
  a.activation.setActive(false);
  b.activation.setActive(true);
  b.pageLocations.goBack();
  expect(b.pages.store.getState().location?.page.id).toBe("editor");
  browser.back();
  expect(b.pages.store.getState().location?.page.id).toBe("start");
  expect(a.pages.store.getState().location?.page.id).toBe("editor");
  browser.forward();
  expect(b.pages.store.getState().location?.page.id).toBe("editor");
  await Promise.all([a.dispose(), b.dispose()]);
});
