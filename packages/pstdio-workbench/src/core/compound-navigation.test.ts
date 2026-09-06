import { expect, test } from "bun:test";
import type { NavigationTargetPage, NavigationTargetPanel, PageLocation } from "@pstdio/sdk/extensions";
import type {
  WorkbenchPageBrowserEntry,
  WorkbenchPageLocationBrowser,
} from "./controllers/page-location/page-location-controller";
import { createWorkbench } from "./workbench-core";

const owner = "acme.notes";
const pageRef = (id: string) => ({ extensionId: owner, kind: "page" as const, id });
const panelRef = (id: string) => ({ extensionId: owner, kind: "placement" as const, id });
const createHarness = () => {
  const entries: WorkbenchPageBrowserEntry[] = [{ url: "/projects/project-1" }];
  let index = 0;
  const listeners = new Set<(entry: WorkbenchPageBrowserEntry) => void>();
  const browser: WorkbenchPageLocationBrowser = {
    current: () => entries[index]!,
    push: (entry) => {
      entries.splice(++index);
      entries.push(entry);
    },
    replace: (entry) => {
      entries[index] = entry;
    },
    back: () => {
      if (index > 0) {
        index--;
        for (const listener of listeners) listener(entries[index]!);
      }
    },
    forward: () => {
      if (index < entries.length - 1) {
        index++;
        for (const listener of listeners) listener(entries[index]!);
      }
    },
    onPopState: (listener) => {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
  };
  const persisted = new Map<string, PageLocation>();
  const workbench = createWorkbench({
    startPage: pageRef("home"),
    initialSidePanelMode: "closed",
    pageLocationBrowser: browser,
    pageLocationPersistence: {
      load: (id) => persisted.get(id),
      save: (id, location) => {
        persisted.set(id, location);
      },
    },
  });
  workbench.modes.registerMode({ id: "notes", activate: () => undefined });
  workbench.views.registerView({ id: "content", title: "Content", body: { kind: "react", render: () => null } });
  for (const id of ["home", "notes"]) {
    workbench.pages.registerPage({
      id,
      ref: pageRef(id),
      title: id,
      path: id,
      modeId: "notes",
      main: { kind: "view", view: { kind: "view", id: "content" }, cardinality: "one" },
      slots: [
        {
          id: "inspector",
          region: "side",
          item: { kind: "view", view: { kind: "view", id: "content" }, presence: "closed" },
        },
      ],
    });
  }
  for (const id of ["shared", "details"])
    workbench.modePlacements.registerPlacement({
      id,
      ref: panelRef(id),
      modeId: "notes",
      region: "secondary",
      item: {
        kind: "binding",
        binding: {
          kinds: [{ kind: "resource-kind", id: "note" }],
          view: { kind: "view", id: "content" },
          cardinality: "many",
        },
      },
    });
  expect(workbench.pageLocations.boot("project-1").ok).toBe(true);
  const snapshot = () => ({
    pages: workbench.pages.store.getState(),
    layout: workbench.layout.getLayout(),
    mode: workbench.modes.store.getState(),
    history: workbench.pageLocations.historyStore.getState(),
    breadcrumbs: workbench.breadcrumbs.getItems(),
    side: workbench.sidePanel.getMode(),
    shared: workbench.modePlacements.resolvePlacements("notes"),
    entries: structuredClone(entries),
    index,
    persisted: structuredClone(persisted),
  });
  return { workbench, entries, browser, snapshot };
};
const notes: NavigationTargetPage = { kind: "page", page: pageRef("notes") };
const inspector: NavigationTargetPanel = {
  kind: "panel",
  panel: { kind: "page-slot", page: pageRef("notes"), id: "inspector" },
};
const shared: NavigationTargetPanel = {
  kind: "panel",
  panel: panelRef("shared"),
  resource: { type: "note", id: "one" },
  open: "pin",
};
const invalid: NavigationTargetPanel = {
  kind: "panel",
  panel: panelRef("details"),
  resource: { type: "wrong-kind", id: "one" },
};

for (const [name, targets] of [
  ["page then invalid panel", [notes, invalid]],
  ["page and page panel then invalid panel", [notes, inspector, invalid]],
  ["valid mode panel then invalid panel", [shared, invalid]],
] as const)
  test(`failed compound navigation leaves no state or history effects: ${name}`, async () => {
    const { workbench, snapshot } = createHarness();
    const before = snapshot();
    const changes: unknown[] = [];
    workbench.pages.store.subscribe((state) => changes.push(state));
    workbench.layout.store.subscribe((state) => changes.push(state));
    await expect(workbench.navigation.openTarget({ kind: "compound", targets })).rejects.toThrow();
    expect(snapshot()).toEqual(before);
    expect(changes).toEqual([]);
  });

test("compound navigation resolves dependent panels against the proposed page and adds one history entry", async () => {
  const { workbench, entries } = createHarness();
  const pages: string[] = [];
  workbench.pages.store.subscribe((state) => pages.push(state.activePageId!));
  await workbench.navigation.openTarget({ kind: "compound", targets: [notes, inspector, shared] });
  expect(entries).toHaveLength(2);
  expect(workbench.pages.store.getState().location?.page).toEqual(pageRef("notes"));
  expect(workbench.layout.getLayout().regions.side.widgets).toHaveLength(1);
  expect(workbench.layout.getLayout().regions.secondary.widgets).toHaveLength(1);
  expect(new Set(pages)).toEqual(new Set(["notes"]));
  workbench.pageLocations.goBack();
  expect(workbench.pages.store.getState().location?.page).toEqual(pageRef("home"));
  workbench.pageLocations.goForward();
  expect(workbench.pages.store.getState().location?.page).toEqual(pageRef("notes"));
});
