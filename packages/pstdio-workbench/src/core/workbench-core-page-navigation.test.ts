import { describe, expect, test } from "bun:test";
import type { PageLocation, PageRef } from "@pstdio/sdk/extensions";
import type {
  WorkbenchPageBrowserEntry,
  WorkbenchPageLocationBrowser,
  WorkbenchPageLocationPersistence,
} from "./controllers/page-location/page-location-controller";
import { createWorkbench } from "./workbench-core";

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
    back: () => undefined,
    forward: () => undefined,
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
  const workbench = createWorkbench({
    pageLocationBrowser: browser.browser,
    pageLocationPersistence: persistence.persistence,
    startPage: startRef,
  });
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  workbench.views.registerView({
    id: "start-view",
    title: "Start",
    body: { kind: "react", render: () => null },
  });
  workbench.views.registerView({
    id: "tickets-view",
    title: "Tickets",
    body: { kind: "react", render: () => null },
  });
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
    slots: [{ id: "content", role: "primary", region: "main", viewId: "tickets-view" }],
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
      expect.objectContaining({ contributionId: "workbench.page-placement.tickets.content" }),
    ]);
    expect(harness.browser.pushes.at(-1)?.url).toBe("/projects/p1/extensions/acme.planner/tickets");
    expect(harness.persistence.values.get("p1")?.page).toEqual(ticketsRef);
  });
});
