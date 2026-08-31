import { describe, expect, test } from "bun:test";
import type { PageLocation, PageRef } from "@pstdio/sdk/extensions";
import type {
  WorkbenchPageBrowserEntry,
  WorkbenchPageLocationBrowser,
  WorkbenchPageLocationPersistence,
} from "./controllers/page-location/page-location-controller";
import { createWorkbenchCore } from "./workbench-core";

const startRef: PageRef = { extensionId: "pstdio", kind: "page", id: "start" };
const ticketsRef: PageRef = { extensionId: "acme.planner", kind: "page", id: "tickets" };

const createBrowser = () => {
  let current: WorkbenchPageBrowserEntry = { url: "/projects/p1" };
  const pushes: WorkbenchPageBrowserEntry[] = [];
  const replacements: WorkbenchPageBrowserEntry[] = [];
  const listeners = new Set<(entry: WorkbenchPageBrowserEntry) => void>();
  const browser: WorkbenchPageLocationBrowser = {
    current: () => current,
    push: (entry) => {
      current = entry;
      pushes.push(entry);
    },
    replace: (entry) => {
      current = entry;
      replacements.push(entry);
    },
    onPopState: (listener) => {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
  };
  return { browser, pushes, replacements };
};

const createPersistence = () => {
  const values = new Map<string, PageLocation>();
  const persistence: WorkbenchPageLocationPersistence = {
    load: (projectId) => values.get(projectId),
    save: (projectId, location) => values.set(projectId, location),
  };
  return { persistence, values };
};

const createHarness = () => {
  const browser = createBrowser();
  const persistence = createPersistence();
  const workbench = createWorkbenchCore({
    pageLocationBrowser: browser.browser,
    pageLocationPersistence: persistence.persistence,
    startPage: startRef,
  });
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  workbench.layout.registerPanel({ id: "start-panel", title: "Start", region: "main", rendererId: "test" });
  workbench.layout.registerPanel({ id: "tickets-panel", title: "Tickets", region: "main", rendererId: "test" });
  workbench.layout.registerPanel({ id: "tools-panel", title: "Tools", region: "side", rendererId: "test" });
  workbench.views.registerView({ id: "start-view", panelId: "start-panel" });
  workbench.views.registerView({ id: "tickets-view", panelId: "tickets-panel" });
  workbench.views.registerView({ id: "tools-view", panelId: "tools-panel" });
  workbench.pages.registerPage({
    id: "start",
    ref: startRef,
    title: "Start",
    path: "",
    modeId: "project",
    slots: [{ id: "content", role: "primary", region: "main", viewId: "start-view" }],
  });
  workbench.pages.registerPage({
    id: "tickets",
    ref: ticketsRef,
    title: "Tickets",
    path: "tickets",
    modeId: "project",
    parentId: "start",
    slots: [
      { id: "content", role: "primary", region: "main", viewId: "tickets-view" },
      {
        id: "tools",
        role: "auxiliary",
        region: "side",
        viewId: "tools-view",
        closable: true,
        defaultOpen: false,
      },
    ],
  });
  return { browser, persistence, workbench };
};

describe("workbench core page navigation", () => {
  test("owns page location navigation in the live core", () => {
    const harness = createHarness();

    harness.workbench.pageLocations.boot("p1");
    harness.workbench.pageLocations.navigate({ kind: "page", page: ticketsRef });

    expect(harness.workbench.pages.store.getState().activePageId).toBe("tickets");
    expect(harness.workbench.layout.getLayout().regions.main.widgets).toEqual([
      expect.objectContaining({ contributionId: "tickets-panel" }),
    ]);
    expect(harness.browser.pushes.at(-1)?.url).toBe("/projects/p1/extensions/acme.planner/tickets");
    expect(harness.persistence.values.get("p1")?.page).toEqual(ticketsRef);
  });

  test("opens a page panel without changing location or browser history", () => {
    const harness = createHarness();
    harness.workbench.pageLocations.boot("p1");
    harness.workbench.pageLocations.navigate({ kind: "page", page: ticketsRef });
    const location = harness.workbench.pages.store.getState().location;
    const writes = harness.browser.pushes.length + harness.browser.replacements.length;

    const result = harness.workbench.panelTargets.open({
      kind: "panel",
      panel: { kind: "page-slot", page: ticketsRef, id: "tools" },
    });

    expect(result).toEqual({
      ok: true,
      identity: { kind: "page", pageId: "tickets", slotId: "tools", instanceKey: "default" },
    });
    expect(harness.workbench.layout.getLayout().regions.side.widgets).toEqual([
      expect.objectContaining({ contributionId: "tools-panel" }),
    ]);
    expect(harness.workbench.pages.store.getState().location).toBe(location);
    expect(harness.browser.pushes.length + harness.browser.replacements.length).toBe(writes);
  });

  test("commits a destination page and its panel in one page state change", () => {
    const harness = createHarness();
    harness.workbench.pageLocations.boot("p1");
    const states: string[][] = [];
    const unsubscribe = harness.workbench.pages.store.subscribe((state) => {
      states.push(state.placements.map((placement) => placement.value.contributionId));
    });
    const writes = harness.browser.pushes.length + harness.browser.replacements.length;

    const result = harness.workbench.pageLocations.navigateWithPanels({ kind: "page", page: ticketsRef }, [
      { kind: "panel", panel: { kind: "page-slot", page: ticketsRef, id: "tools" } },
    ]);

    unsubscribe();
    expect(result.ok).toBe(true);
    expect(states).toEqual([["tickets-panel", "tools-panel"]]);
    expect(harness.browser.pushes.length + harness.browser.replacements.length).toBe(writes + 1);
    expect(harness.persistence.values.get("p1")?.page).toEqual(ticketsRef);
  });

  test("does not expose a destination page when one of its panels cannot resolve", () => {
    const harness = createHarness();
    harness.workbench.pageLocations.boot("p1");
    const location = harness.workbench.pages.store.getState().location;
    const writes = harness.browser.pushes.length + harness.browser.replacements.length;
    let stateChanges = 0;
    const unsubscribe = harness.workbench.pages.store.subscribe(() => {
      stateChanges += 1;
    });

    const result = harness.workbench.pageLocations.navigateWithPanels({ kind: "page", page: ticketsRef }, [
      { kind: "panel", panel: { kind: "page-slot", page: ticketsRef, id: "missing" } },
    ]);

    unsubscribe();
    expect(result).toEqual({
      ok: false,
      diagnostic: {
        code: "page-location-unresolved",
        source: "navigation",
        message: "Unknown page slot: tickets.missing",
      },
    });
    expect(stateChanges).toBe(0);
    expect(harness.workbench.pages.store.getState().location).toBe(location);
    expect(harness.workbench.layout.getLayout().regions.main.widgets).toEqual([
      expect.objectContaining({ contributionId: "start-panel" }),
    ]);
    expect(harness.browser.pushes.length + harness.browser.replacements.length).toBe(writes);
    expect(harness.persistence.values.get("p1")).toBe(location);
  });

  test("dispatches an SDK page and its panels through one navigation transaction", async () => {
    const harness = createHarness();
    harness.workbench.pageLocations.boot("p1");
    const states: string[][] = [];
    const unsubscribe = harness.workbench.pages.store.subscribe((state) => {
      states.push(state.placements.map((placement) => placement.value.contributionId));
    });
    const writes = harness.browser.pushes.length + harness.browser.replacements.length;

    await harness.workbench.navigation.openTarget({
      kind: "compound",
      targets: [
        { kind: "page", page: ticketsRef },
        { kind: "panel", panel: { kind: "page-slot", page: ticketsRef, id: "tools" } },
      ],
    });

    unsubscribe();
    expect(states).toEqual([["tickets-panel", "tools-panel"]]);
    expect(harness.browser.pushes.length + harness.browser.replacements.length).toBe(writes + 1);
    expect(harness.persistence.values.get("p1")?.page).toEqual(ticketsRef);
  });

  test("rejects an invalid SDK compound before changing page, history, or persistence", async () => {
    const harness = createHarness();
    harness.workbench.pageLocations.boot("p1");
    const state = harness.workbench.pages.store.getState();
    const writes = harness.browser.pushes.length + harness.browser.replacements.length;
    let stateChanges = 0;
    const unsubscribe = harness.workbench.pages.store.subscribe(() => {
      stateChanges += 1;
    });

    await expect(
      harness.workbench.navigation.openTarget({
        kind: "compound",
        targets: [
          { kind: "page", page: ticketsRef },
          { kind: "panel", panel: { kind: "page-slot", page: ticketsRef, id: "missing" } },
        ],
      }),
    ).rejects.toThrow("Unknown page slot: tickets.missing");

    unsubscribe();
    expect(stateChanges).toBe(0);
    expect(harness.workbench.pages.store.getState()).toBe(state);
    expect(harness.browser.pushes.length + harness.browser.replacements.length).toBe(writes);
    expect(harness.persistence.values.get("p1")).toBe(state.location);
  });
});
