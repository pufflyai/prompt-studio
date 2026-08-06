import { expect, test } from "bun:test";
import type { WorkbenchLayout } from "@pstdio/workbench";
import { createLocalStorageLayoutPersistence, type WorkbenchStorageLike } from "@pstdio/workbench/storage";
import { createExtensionLayoutPersistence } from "./extension-layout-persistence";
import type { ExtensionLayoutCompatibility } from "./extension-layout-reconciliation";

const createStorage = (): WorkbenchStorageLike => {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
};

const staleLayout = (): WorkbenchLayout => {
  const regions = Object.fromEntries(
    [
      "nav",
      "activity",
      "sidenav-header",
      "sidenav",
      "main-header",
      "main-left-menu",
      "main",
      "main-right-menu",
      "secondary-header",
      "secondary-left-menu",
      "secondary",
      "secondary-right-menu",
      "side-header",
      "side-left-menu",
      "side",
      "side-right-menu",
      "status",
      "overlay",
    ].map((id) => [id, { id, visible: true, widgets: [] }]),
  ) as unknown as WorkbenchLayout["regions"];
  regions.main.widgets = [
    { widgetId: "native.notes", contributionId: "native.notes", closable: false },
    { widgetId: "extension-lab.old", contributionId: "extension-lab.old", closable: false },
  ];
  return { regions };
};

const removedCompatibility: ExtensionLayoutCompatibility = {
  owners: [{ extensionId: "pstdio.extension-lab", name: "extension-lab" }],
  panels: [],
  revision: "removed-v1",
};

const existingCompatibility: ExtensionLayoutCompatibility = {
  owners: removedCompatibility.owners,
  panels: [
    {
      aliases: ["extension-lab.old"],
      contributionId: "extension-lab.old",
      extensionId: "pstdio.extension-lab",
      logicalId: "extension-lab.old",
    },
  ],
  revision: "existing-v1",
};

test("reconciles aggregate and resource layouts for a project once per compatibility revision", () => {
  const storage = createStorage();
  const layoutPersistence = createLocalStorageLayoutPersistence({
    debounceMs: 60_000,
    namespace: "dashboard",
    storage,
  });
  const persistence = createExtensionLayoutPersistence({ layoutPersistence, namespace: "dashboard", storage });
  const scopes = [
    "project/one/mode/project/aggregate/empty",
    "project/one/mode/project/aggregate/tickets",
    "project/one/mode/project/aggregate/workspaces",
    "project/one/mode/ticket/resource/pstdio://ticket/PS-1",
  ];
  for (const scope of scopes) layoutPersistence.setLayout(staleLayout(), scope);

  const first = persistence.reconcile("one", removedCompatibility);
  const repeated = persistence.reconcile("one", removedCompatibility);

  expect(first.scopes).toEqual(scopes);
  expect(repeated.updated).toBe(0);
  for (const scope of scopes) {
    expect(layoutPersistence.getLayout(scope)?.regions.main.widgets.map((entry) => entry.contributionId)).toEqual([
      "native.notes",
    ]);
  }
});

test("applies a durable reset only to the requested mode", () => {
  const storage = createStorage();
  const layoutPersistence = createLocalStorageLayoutPersistence({
    debounceMs: 60_000,
    namespace: "dashboard",
    storage,
  });
  const persistence = createExtensionLayoutPersistence({ layoutPersistence, namespace: "dashboard", storage });
  const compatibility: ExtensionLayoutCompatibility = {
    owners: removedCompatibility.owners,
    panels: [
      {
        aliases: ["extension-lab.old"],
        contributionId: "extension-lab.old",
        extensionId: "pstdio.extension-lab",
        logicalId: "extension-lab.old",
      },
    ],
    revision: "current-v1",
  };
  const ticketsScope = "project/one/mode/ticket/resource/pstdio://ticket/PS-1";
  const projectScope = "project/one/mode/project/aggregate/tickets";
  layoutPersistence.setLayout(staleLayout(), ticketsScope);
  layoutPersistence.setLayout(staleLayout(), projectScope);

  const first = persistence.applyResets("one", compatibility, [
    { extensionId: "pstdio.extension-lab", modeId: "ticket", revision: "reset-1" },
  ]);
  const repeated = persistence.applyResets("one", compatibility, [
    { extensionId: "pstdio.extension-lab", modeId: "ticket", revision: "reset-1" },
  ]);

  expect(first[0]?.scopes).toEqual([ticketsScope]);
  expect(repeated).toEqual([]);
  expect(layoutPersistence.getLayout(ticketsScope)?.regions.main.widgets.map((entry) => entry.contributionId)).toEqual([
    "native.notes",
  ]);
  expect(layoutPersistence.getLayout(projectScope)?.regions.main.widgets).toHaveLength(2);
});

test("rejects a stale page flush after another host observes a newer contribution revision", () => {
  const storage = createStorage();
  const staleLayoutPersistence = createLocalStorageLayoutPersistence({
    debounceMs: 60_000,
    namespace: "dashboard",
    storage,
  });
  const currentLayoutPersistence = createLocalStorageLayoutPersistence({
    debounceMs: 60_000,
    namespace: "dashboard",
    storage,
  });
  const stalePage = createExtensionLayoutPersistence({
    layoutPersistence: staleLayoutPersistence,
    namespace: "dashboard",
    storage,
  });
  const currentPage = createExtensionLayoutPersistence({
    layoutPersistence: currentLayoutPersistence,
    namespace: "dashboard",
    storage,
  });
  const scope = "project/one/mode/project/resource/pstdio://ticket/PS-1";

  staleLayoutPersistence.setLayout(staleLayout(), scope);
  staleLayoutPersistence.flush();
  stalePage.reconcile("one", existingCompatibility);
  stalePage.applyResets("one", existingCompatibility, []);
  staleLayoutPersistence.setLayout(staleLayout(), scope);

  currentPage.reconcile("one", removedCompatibility);
  currentPage.applyResets("one", removedCompatibility, []);
  stalePage.reconcile("one", removedCompatibility);
  stalePage.applyResets("one", removedCompatibility, []);
  stalePage.layoutPersistence.setLayout(staleLayout(), scope);
  staleLayoutPersistence.flush();

  expect(currentLayoutPersistence.getLayout(scope)?.regions.main.widgets.map((entry) => entry.contributionId)).toEqual([
    "native.notes",
  ]);
});
