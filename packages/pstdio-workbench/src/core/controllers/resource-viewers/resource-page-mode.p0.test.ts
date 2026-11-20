import { expect, test } from "bun:test";
import type { WorkbenchLayout } from "../../registries/layout/layout-types";
import { createWorkbench } from "../../workbench-core";
import { createMemoryWorkbenchPageLocationBrowser } from "../page-location/page-location-memory";
import type { PersistedWorkbenchPageLocation } from "../page-location/page-location-types";
import { viewerPage } from "./resource-viewer-test-fixture";

const fixture = (missingDefault: boolean, reject: () => boolean = () => false) => {
  const browser = createMemoryWorkbenchPageLocationBrowser();
  const locations = new Map<string, PersistedWorkbenchPageLocation>();
  const saved = new Map<string | undefined, WorkbenchLayout>();
  const create = () => {
    const w = createWorkbench({
      defaultPage: viewerPage(missingDefault ? "missing" : "home"),
      pageLocationBrowser: {
        ...browser,
        push: (entry) => {
          if (reject()) throw new Error("History rejected");
          browser.push(entry);
        },
      },
      pageLocationPersistence: {
        load: (id) => locations.get(id),
        save: (id, value) => {
          locations.set(id, value);
        },
      },
      layoutPersistence: {
        getLayout: (scope) => saved.get(scope),
        setLayout: (value, scope) => {
          saved.set(scope, structuredClone(value));
        },
        listLayouts: () => [...saved].map(([scope, layout]) => ({ scope, layout })),
      },
    });
    for (const id of ["project", "settings"]) w.modes.registerMode({ id, activate() {} });
    w.views.registerView({ id: "settings", title: "Settings", body: { kind: "react", render: () => null } });
    w.pages.registerPage({
      id: "home",
      ref: viewerPage("home"),
      path: "home",
      modeId: "project",
      main: { kind: "panels" },
      slots: [],
    });
    w.pages.registerPage({
      id: "settings",
      ref: viewerPage("settings"),
      path: "settings",
      modeId: "settings",
      main: { kind: "view", presentation: "page", cardinality: "one", view: { kind: "view", id: "settings" } },
      slots: [],
    });
    w.pageLocations.setProject("project");
    return w;
  };
  return { w: create(), create, browser, locations };
};

for (const missingDefault of [false, true])
  test(`a moved static page stays in its mode through reload and history; missing default=${missingDefault}`, () => {
    const { w, create, browser, locations } = fixture(missingDefault);
    w.pageLocations.navigate({ kind: "page", page: viewerPage("settings") });
    w.movePanel(w.pages.getContent()!.widgetId, "side");
    expect(browser.current().url).toBe("/projects/project");
    expect(locations.get("project")?.location).toBeUndefined();
    w.pageLocations.dispose();
    const restored = create();
    restored.pageLocations.boot("project");
    expect(restored.modes.getActiveModeId()).toBe("settings");
    expect(restored.pages.getContent()).toBeUndefined();
    expect(restored.layout.getActivePanel("side")?.viewId).toBe("settings");
    restored.pageLocations.goBack();
    expect(restored.pages.getContent()?.viewId).toBe("settings");
    expect(restored.layout.listPanelInstances("side")).toHaveLength(0);
    restored.pageLocations.goForward();
    expect(restored.pages.getContent()).toBeUndefined();
  });

test("a rejected browser commit preserves a non-default mode's departing page", () => {
  let reject = false;
  const { w, browser, locations } = fixture(false, () => reject);
  w.pageLocations.navigate({ kind: "page", page: viewerPage("settings") });
  const state = w.pages.store.getState();
  const entry = browser.current();
  const saved = locations.get("project");
  reject = true;
  expect(() => w.movePanel(w.pages.getContent()!.widgetId, "side")).toThrow("History rejected");
  expect(w.pages.store.getState()).toBe(state);
  expect(browser.current()).toBe(entry);
  expect(locations.get("project")).toBe(saved);
  expect(w.layout.listPanelInstances("side")).toHaveLength(0);
});
