import { expect, test } from "bun:test";
import type { PageLocation } from "@pstdio/sdk/extensions";
import type { WorkbenchPageBrowserEntry } from "./controllers/page-location/page-location-controller";
import { createWorkbench } from "./workbench-core";

const page = (id: string) => ({ kind: "page" as const, extensionId: "test", id });
const shared = { kind: "placement" as const, extensionId: "test", id: "shared" };
const target = {
  kind: "compound" as const,
  targets: [
    { kind: "page" as const, page: page("edit") },
    { kind: "panel" as const, panel: shared, resource: { type: "file", id: "readme" }, open: "pin" as const },
  ],
};
function harness(
  failure: "browser" | "location-cache" | "layout-cache" | "menu-read" | "menu-write" | "mode-hook" | "subscriber",
) {
  let armed = false;
  let saved: PageLocation | undefined;
  const entries: WorkbenchPageBrowserEntry[] = [{ url: "/projects/project" }];
  const workbench = createWorkbench({
    startPage: page("home"),
    resolvePagePersistenceScope: ({ pageId }) => ({ scope: pageId }),
    panelMenuStatePersistence: {
      getMenuStates() {
        if (armed && failure === "menu-read") throw new Error("Menu cache read failed");
        return undefined;
      },
      setMenuStates() {
        if (armed && failure === "menu-write") throw new Error("Menu cache write failed");
      },
    },
    pageLocationBrowser: {
      current: () => entries.at(-1)!,
      push(entry) {
        if (armed && failure === "browser") throw new Error("Cannot write browser history");
        entries.push(entry);
      },
      replace(entry) {
        entries[entries.length - 1] = entry;
      },
      back() {},
      forward() {},
      onPopState() {
        return { dispose() {} };
      },
    },
    pageLocationPersistence: {
      load: () => saved,
      save(_id, location) {
        if (armed && failure === "location-cache") throw new Error("Location cache is full");
        saved = location;
      },
    },
    layoutPersistence: {
      getLayout: () => undefined,
      setLayout() {
        if (armed && failure === "layout-cache") throw new Error("Layout cache is full");
      },
    },
  });
  workbench.views.registerView({ id: "content", title: "Content", body: { kind: "react", render: () => null } });
  for (const id of ["home", "edit"]) {
    workbench.modes.registerMode({
      id,
      activate() {
        if (armed && id === "edit" && failure === "mode-hook") throw new Error("Mode hook failed");
      },
    });
    workbench.pages.registerPage({
      id,
      ref: page(id),
      path: id,
      modeId: id,
      slots: [],
      main: { kind: "view", view: { kind: "view", id: "content" }, cardinality: "one" },
    });
  }
  workbench.modePlacements.registerPlacement({
    id: "shared",
    ref: shared,
    modeId: "edit",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", id: "file" }],
        view: { kind: "view", id: "content" },
        cardinality: "many",
      },
    },
  });
  workbench.pageLocations.boot("project");
  const changes: unknown[] = [];
  workbench.pages.store.subscribe(() => {
    if (failure === "subscriber") throw new Error("Subscriber failed");
  });
  workbench.pages.store.subscribe((state) => changes.push(state));
  const snapshot = () => ({
    pages: workbench.pages.store.getState(),
    mode: workbench.modes.store.getState(),
    owned: workbench.modePlacements.resolvePlacements("edit"),
    layout: workbench.layout.getLayout(),
    history: workbench.pageLocations.historyStore.getState(),
    breadcrumbs: workbench.breadcrumbs.getItems(),
    saved,
    entries: structuredClone(entries),
    changes: [...changes],
  });
  armed = true;
  return { workbench, snapshot, entries, changes };
}

test("a browser commit failure leaves every navigation owner unchanged", async () => {
  const { workbench, snapshot } = harness("browser");
  const before = snapshot();
  await expect(workbench.navigation.openTarget(target)).rejects.toThrow("Cannot write browser history");
  expect(snapshot()).toEqual(before);
});

for (const failure of ["location-cache", "layout-cache", "menu-read", "menu-write", "mode-hook", "subscriber"] as const)
  test(`a ${failure} fault does not reject or interrupt committed navigation`, async () => {
    const { workbench, entries, changes } = harness(failure);
    await workbench.navigation.openTarget(target);
    expect(workbench.pages.store.getState().activePageId).toBe("edit");
    expect(workbench.modes.getActiveModeId()).toBe("edit");
    expect(workbench.modePlacements.resolvePlacements("edit")).toHaveLength(1);
    expect(workbench.layout.getLayout().regions.side.widgets).toHaveLength(1);
    expect(workbench.pageLocations.historyStore.getState().canGoBack).toBe(true);
    expect(entries).toHaveLength(2);
    expect(changes.length).toBeGreaterThan(0);
  });

test("every navigation observer reads the final page breadcrumbs", async () => {
  const { workbench } = harness("mode-hook");
  const seen: unknown[] = [];
  for (const store of [
    workbench.modes.store,
    workbench.layout.store,
    workbench.pages.store,
    workbench.pageLocations.historyStore,
  ]) {
    store.subscribe(() =>
      seen.push({
        page: workbench.pages.store.getState().activePageId,
        breadcrumbs: workbench.breadcrumbs.getItems()?.map((item) => item.title),
      }),
    );
  }
  await workbench.navigation.openTarget(target);
  expect(seen.length).toBeGreaterThan(0);
  expect(seen.every((value) => JSON.stringify(value) === JSON.stringify({ page: "edit", breadcrumbs: ["edit"] }))).toBe(
    true,
  );
});
