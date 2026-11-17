import { expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { defaultPageResourceCodec } from "pstdio-api-contracts/extension-kernel";
import { createWorkbench } from "../../core";
import { createPageUrlResolver } from "../../core/controllers/page-location/page-url-resolver";
import { createLocalStorageWorkbenchPersistence } from "../../storage/local-storage-persistence";
import { emptyWorkbenchExtensionMetadata } from "../contributions/extension-contributions";
import { registerWorkbenchExtensionContributions } from "./workbench-extension-host";
import { registerWorkbenchIdentityAliases } from "./workbench-identity-aliases";

const metadata = (extensionId: string, resourceBacked = false): WorkbenchExtensionMetadata => ({
  ...emptyWorkbenchExtensionMetadata,
  extensions: [{ id: extensionId, name: "notes", displayName: "Notes", sourcePath: "/notes" }],
  modes: [{ id: `${extensionId}.mode.notes`, localId: "notes", extensionId, label: "Notes", regions: ["main"] }],
  pages: [
    {
      id: `${extensionId}.page.notes`,
      localId: "notes",
      extensionId,
      title: "Notes",
      path: "notes",
      mode: { kind: "mode", extensionId, id: "notes" },
      ...(resourceBacked ? { resource: { kinds: [{ kind: "resource-kind" as const, extensionId, id: "note" }] } } : {}),
      main: { kind: "panels", empty: { kind: "view", extensionId, id: "reader" } },
      slots: [
        {
          id: "reader",
          region: "main",
          item: { kind: "view", view: { kind: "view", extensionId, id: "reader" }, presence: "open" },
        },
      ],
    },
  ],
  views: [
    {
      id: `${extensionId}.view.reader`,
      localId: "reader",
      extensionId,
      title: "Reader",
      body: {
        kind: "webview",
        webview: {
          entry: { kind: "package-asset", path: "./view.tsx", baseUrl: "file:///notes/" },
          runtimeUrl: "/runtime",
          moduleUrl: "/module.js",
        },
      },
    },
  ],
});

test.each([
  { closed: false, resourceBacked: false },
  { closed: true, resourceBacked: false },
  { closed: false, resourceBacked: true },
  { closed: true, resourceBacked: true },
])("a saved historical location preserves Main panel state: %o", async ({ closed, resourceBacked }) => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const create = (owner: string) => {
    const workbench = createWorkbench({
      ...createLocalStorageWorkbenchPersistence({ namespace: "rename", storage, debounceMs: 0 }),
    });
    const registration = registerWorkbenchExtensionContributions({
      workbench,
      metadata: metadata(owner, resourceBacked),
      projectId: "project",
      executeCommand: () => undefined,
    });
    workbench.pageLocations.setProject("project");
    return { workbench, registration };
  };
  const first = create("pstdio.pstdio-notes");
  expect(
    first.workbench.pageLocations.navigate({
      kind: "page",
      page: { kind: "page", extensionId: "pstdio.pstdio-notes", id: "notes" },
      ...(resourceBacked
        ? { resource: { extensionId: "pstdio.pstdio-notes", projectId: "project", type: "note", id: "stable-note" } }
        : {}),
    }).ok,
  ).toBe(true);
  if (closed) {
    const panel = first.workbench.layout.getLayout().regions.main.widgets[0]!;
    expect(first.workbench.pageLocations.closePlacement(panel.placementIdentity!).ok).toBe(true);
  }
  await first.workbench.dispose();
  first.registration.dispose();
  const second = create("pstdio.notes");
  try {
    expect(second.workbench.pageLocations.boot("project").ok).toBe(true);
    expect(second.workbench.pages.store.getState().activePageId).toBe("pstdio.notes.page.notes");
    const panels = second.workbench.layout.getLayout().regions.main.widgets;
    expect(panels).toHaveLength(closed ? 0 : 1);
    if (!closed) expect(second.workbench.views.getView(panels[0]!.viewId!)).toBeDefined();
  } finally {
    second.registration.dispose();
    await second.workbench.dispose();
  }
});

test("historical page links and view IDs resolve to one canonical enabled contribution", async () => {
  const workbench = createWorkbench();
  const registration = registerWorkbenchExtensionContributions({
    workbench,
    metadata: metadata("pstdio.notes"),
    projectId: "project",
    executeCommand: () => undefined,
  });
  try {
    workbench.pageLocations.setProject("project");
    expect(workbench.views.getView("pstdio.pstdio-notes.view.reader")?.id).toBe("pstdio.notes.view.reader");
    expect(workbench.views.listViews()).toHaveLength(1);
    expect(
      createPageUrlResolver({
        pages: () => workbench.pages.listPages(),
        resources: defaultPageResourceCodec,
        normalize: () => {
          throw new Error("Unexpected history");
        },
      })("project", { url: "/projects/project/extensions/pstdio.pstdio-notes/notes" })?.location.page,
    ).toEqual({ kind: "page", id: "notes", extensionId: "pstdio.notes" });
    expect(
      workbench.pageLocations.navigate({
        kind: "page",
        page: { kind: "page", extensionId: "pstdio.pstdio-notes", id: "notes" },
      }).ok,
    ).toBe(true);
    expect(workbench.pages.store.getState().activePageId).toBe("pstdio.notes.page.notes");
    expect(workbench.layout.getLayout().regions.main.widgets).toHaveLength(1);
  } finally {
    registration.dispose();
    await workbench.dispose();
  }
  expect(workbench.views.getView("pstdio.pstdio-notes.view.reader")).toBeUndefined();
});

test("historical command actions reach one enabled canonical workbench command", async () => {
  const workbench = createWorkbench();
  const calls: string[] = [];
  const data = {
    ...metadata("pstdio.notes"),
    commands: [
      {
        id: "pstdio.notes.command.notes.create",
        localId: "notes.create",
        extensionId: "pstdio.notes",
        title: "Create",
      },
    ],
  };
  const registration = registerWorkbenchExtensionContributions({
    workbench,
    metadata: data,
    projectId: "project",
    executeCommand: (id) => {
      calls.push(id);
    },
  });
  try {
    await workbench.navigation.openTarget({ kind: "command", commandId: "pstdio.pstdio-notes.command.notes.create" });
    expect(calls).toEqual(["pstdio.notes.command.notes.create"]);
    expect(
      workbench.commands
        .listCommands()
        .filter((command) =>
          ["pstdio.notes.command.notes.create", "pstdio.pstdio-notes.command.notes.create"].includes(
            command.command.id,
          ),
        ),
    ).toHaveLength(1);
  } finally {
    registration.dispose();
    await workbench.dispose();
  }
  expect(workbench.commands.getCommand("pstdio.pstdio-notes.command.notes.create")).toBeUndefined();
});

test("reselecting an active historical mode does not enter it a second time", async () => {
  const workbench = createWorkbench();
  let enters = 0;
  workbench.modes.registerMode({
    id: "pstdio.notes.mode.notes",
    activate() {},
    enter() {
      enters++;
    },
  });
  const aliases = registerWorkbenchIdentityAliases({
    workbench,
    metadata: metadata("pstdio.notes"),
    projectId: "project",
    executeCommand() {},
  });
  try {
    workbench.modes.setActiveMode("pstdio.notes.mode.notes");
    workbench.modes.setActiveMode("pstdio.pstdio-notes.mode.notes");
    expect(enters).toBe(1);
  } finally {
    for (const alias of aliases) alias.dispose();
    await workbench.dispose();
  }
});

test("historical settings actions share one enabled panel and collection item cache", async () => {
  const workbench = createWorkbench();
  const owner = "pstdio.cloud";
  const panelId = `${owner}.settings-panel.cloud`;
  const sectionId = `${owner}.settings-section.account`;
  const oldPanel = "pstdio.pstdio-cloud.settings-panel.cloud";
  const oldSection = "pstdio.pstdio-cloud.settings-section.account";
  const item = { id: "stable-item", label: "Device" };
  const view = workbench.views.registerView({
    id: "devices",
    title: "Devices",
    body: { kind: "react", render: () => null },
  });
  const section = workbench.settings.registerSection({ id: sectionId, title: "Account" });
  const panel = workbench.settings.registerPanel({
    id: panelId,
    title: "Cloud",
    kind: "collection",
    viewId: "devices",
    items: () => [item],
    itemId: (value) => value.id,
    itemLabel: (value) => value.label,
  });
  const aliases = registerWorkbenchIdentityAliases({
    workbench,
    projectId: "project",
    executeCommand: () => undefined,
    metadata: {
      ...metadata(owner),
      settingsSections: [{ id: sectionId, extensionId: owner, localId: "account", title: "Account" }],
      settingsPanels: [
        {
          id: panelId,
          extensionId: owner,
          localId: "cloud",
          view: { kind: "view", id: "devices", extensionId: owner },
          slot: { id: "cloud" },
        },
      ],
    },
  });
  try {
    expect(workbench.settings.getPanel(oldPanel)?.id).toBe(panelId);
    expect(workbench.settings.getSection(oldSection)?.id).toBe(sectionId);
    expect(await workbench.settings.resolveCollectionItem(oldPanel, item.id)).toEqual(item);
    expect(workbench.settings.getCollectionItem(panelId, item.id)).toEqual(item);
    expect(workbench.settings.listPanels().filter((value) => value.id === panelId)).toHaveLength(1);
  } finally {
    for (const alias of aliases) alias.dispose();
    panel.dispose();
    section.dispose();
    view.dispose();
    await workbench.dispose();
  }
  expect(workbench.settings.getPanel(oldPanel)).toBeUndefined();
});
