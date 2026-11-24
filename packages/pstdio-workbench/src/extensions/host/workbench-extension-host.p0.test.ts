import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { PstdioConnectionError } from "@pstdio/sdk/client";
import { createScopedQueryClient } from "@pstdio/sdk/extensions";
import { createMemoryActivity } from "@pstdio/sdk/testing";
import { createWorkbench, getWorkbenchRenderers, type WorkbenchModuleContribution } from "../../core";
import { getWorkbenchOperations } from "../../core/registries/mutations/operations";
import { resolvePanelMenuRegionState } from "../../react/panel-menu/panel-menu-placements";
import { buildSettingsTreeBody } from "../../react/settings/settings-tree";
import { registerWorkbenchExtensionContributions } from "./workbench-extension-host";

const extensionId = "pstdio.lab";
const modeId = `${extensionId}.mode.review`;
const treeViewId = `${extensionId}.view.outline`;
const controlsViewId = `${extensionId}.view.filters`;
const detailViewId = `${extensionId}.view.detail`;
const statusViewId = `${extensionId}.view.sync-status`;
const metadata = {
  extensions: [{ id: extensionId, name: "lab", displayName: "Lab", sourcePath: "/extensions/lab" }],
  commands: [],
  menuContributions: [],
  commandPaletteContributions: [],
  modes: [{ id: modeId, localId: "review", extensionId, label: "Review", regions: ["main"] }],
  pages: [
    {
      id: `${extensionId}.page.review`,
      localId: "review",
      extensionId,
      title: "Review",
      path: "review",
      mode: { extensionId, kind: "mode", id: "review" },
      main: {
        kind: "view",
        view: { extensionId, kind: "view", id: "filters" },
        cardinality: "one",
      },
      slots: [],
    },
  ],
  views: [
    {
      id: treeViewId,
      localId: "outline",
      extensionId,
      title: "Outline",
      body: {
        kind: "tree",
        bodyHandlerId: `${treeViewId}.tree.body`,
        refreshEventIds: [`${extensionId}.event.outline.changed`],
      },
    },
    {
      id: controlsViewId,
      localId: "filters",
      extensionId,
      title: "Filters",
      body: {
        kind: "controls",
        queryHandlerId: `${controlsViewId}.controls.query`,
      },
    },
    {
      id: detailViewId,
      localId: "detail",
      extensionId,
      title: "Detail",
      body: {
        kind: "webview",
        webview: {
          entry: { kind: "package-asset", path: "./detail.tsx", baseUrl: "file:///extensions/lab/" },
          runtimeUrl: "/runtime.html",
          moduleUrl: "/detail.js",
        },
      },
    },
    {
      id: statusViewId,
      localId: "sync-status",
      extensionId,
      title: "Sync status",
      body: {
        kind: "webview",
        webview: {
          entry: { kind: "package-asset", path: "./sync-status.tsx", baseUrl: "file:///extensions/lab/" },
          runtimeUrl: "/runtime.html",
          moduleUrl: "/sync-status.js",
        },
      },
    },
  ],
  viewMenus: [
    {
      id: `${extensionId}.view-menu.review-outline`,
      extensionId,
      owner: { extensionId, kind: "view", id: "filters" },
      view: { extensionId, kind: "view", id: "outline" },
      side: "left",
      placement: "first",
      hostTreeHeader: "default",
    },
  ],
  placements: [
    {
      id: `${extensionId}.placement.outline`,
      localId: "outline",
      extensionId,
      mode: { extensionId, kind: "mode", id: "review" },
      item: { kind: "view", view: { extensionId, kind: "view", id: "outline" }, presence: "fixed" },
      region: "main",
    },
    {
      id: `${extensionId}.placement.detail`,
      localId: "detail",
      extensionId,
      mode: { extensionId, kind: "mode", id: "review" },
      item: {
        kind: "binding",
        binding: {
          kinds: [{ extensionId, kind: "resource-kind", id: "artifact" }],
          view: { extensionId, kind: "view", id: "detail" },
          cardinality: "many",
        },
      },
      region: "side",
    },
  ],
  resourceKinds: [
    {
      id: "artifact",
      localId: "artifact",
      extensionId,
      label: "Artifact",
    },
  ],
  navigationItems: [],
  navigationTrees: [],
  statusBarItems: [
    {
      id: `${extensionId}.status-bar-item.sync-status`,
      extensionId,
      view: { extensionId, kind: "view", id: "sync-status" },
      popover: { extensionId, kind: "view", id: "sync-status" },
      slot: { id: "workbench.statusBar.trailing" },
      order: 20,
      when: { mode: { extensionId, kind: "mode", id: "review" } },
    },
  ],
  settingsPanels: [],
  diagnostics: [],
} satisfies WorkbenchExtensionMetadata;
describe("registerWorkbenchExtensionContributions", () => {
  test("registers an extension's center status-bar slot", () => {
    const workbench = createWorkbench();
    const registered = registerWorkbenchExtensionContributions({
      projectId: "project",
      workbench,
      executeCommand: async () => undefined,
      metadata: {
        ...metadata,
        statusBarItems: metadata.statusBarItems.map((item) => ({
          ...item,
          slot: { id: "workbench.statusBar.center" },
        })),
      },
    });
    expect(workbench.statusBar.getItem(`${extensionId}.status-bar-item.sync-status`)?.slot).toBe("center");
    registered.dispose();
  });
  test("groups extension settings by owner", async () => {
    const workbench = createWorkbench();
    for (const [id, title] of [
      ["host.extensions.settings", "Extension settings"],
      ["host.repositories.settings", "Repository settings"],
      ["host.danger.settings", "Danger zone settings"],
    ] as const) {
      workbench.views.registerView({ id, title, body: { kind: "react", render: () => null } });
    }
    workbench.settings.registerSection({ id: "workbench", title: "Workbench", order: 10 });
    workbench.settings.registerSection({ id: "project", title: "Project", order: 20 });
    workbench.settings.registerPanel({
      id: "host.extensions",
      title: "Extensions",
      kind: "view",
      order: 10,
      section: "project",
      viewId: "host.extensions.settings",
    });
    workbench.settings.registerPanel({
      id: "host.repositories",
      title: "Repositories",
      kind: "view",
      order: 20,
      section: "project",
      viewId: "host.repositories.settings",
    });
    workbench.settings.registerPanel({
      id: "host.danger",
      title: "Danger zone",
      kind: "view",
      order: 90,
      section: "project",
      viewId: "host.danger.settings",
    });
    const settingsMetadata = {
      ...metadata,
      views: [
        ...metadata.views,
        {
          id: `${extensionId}.view.zebra-settings`,
          localId: "zebra-settings",
          extensionId,
          title: "Zebra settings",
          icon: "zebra",
          body: {
            kind: "webview",
            webview: {
              entry: { kind: "package-asset", path: "./zebra.tsx", baseUrl: "file:///extensions/lab/" },
              runtimeUrl: "/runtime.html",
              moduleUrl: "/zebra.js",
            },
          },
        },
        {
          id: `${extensionId}.view.alpha-settings`,
          localId: "alpha-settings",
          extensionId,
          title: "Alpha settings",
          icon: "alpha",
          body: {
            kind: "webview",
            webview: {
              entry: { kind: "package-asset", path: "./alpha.tsx", baseUrl: "file:///extensions/lab/" },
              runtimeUrl: "/runtime.html",
              moduleUrl: "/alpha.js",
            },
          },
        },
      ],
      settingsSections: [
        {
          id: `${extensionId}.settings-section.lab`,
          extensionId,
          title: "Lab",
          order: 30,
        },
      ],
      settingsPanels: [
        {
          id: `${extensionId}.settings-panel.filters`,
          extensionId,
          view: { extensionId, kind: "view", id: "filters" },
          slot: { id: "project.settingsPanels" },
          section: { extensionId, kind: "settings-section", id: "lab" },
        },
        {
          id: `${extensionId}.settings-panel.zebra`,
          extensionId,
          view: { extensionId, kind: "view", id: "zebra-settings" },
          slot: { id: "project.settingsPanels" },
          section: { extensionId, kind: "settings-section", id: "lab" },
        },
        {
          id: `${extensionId}.settings-panel.alpha`,
          extensionId,
          view: { extensionId, kind: "view", id: "alpha-settings" },
          slot: { id: "project.settingsPanels" },
          section: { extensionId, kind: "settings-section", id: "lab" },
        },
      ],
    } satisfies WorkbenchExtensionMetadata;
    registerWorkbenchExtensionContributions({
      executeCommand: () => undefined,
      metadata: settingsMetadata,
      projectId: "project-1",
      settingsSectionId: "project",
      settingsSectionTitle: "Project",
      workbench,
    });
    const tree = await buildSettingsTreeBody({
      settings: workbench.settings,
      hasProjectScope: true,
      matchesWhen: (when) => workbench.context.matches(when),
    });
    expect(tree.map((section) => ({ label: section.label, nodes: section.nodes.map((node) => node.label) }))).toEqual([
      { label: "Project", nodes: ["Extensions", "Repositories", "Danger zone"] },
      { label: "Lab", nodes: ["Alpha settings", "Filters", "Zebra settings"] },
    ]);
  });
  test("prepares extension command arguments through the host adapter", async () => {
    const workbench = createWorkbench();
    const commandId = `${extensionId}.command.inspect`;
    const argumentChanges: unknown[] = [];
    const preparedCalls: Array<{
      commandId: string;
      args: unknown;
    }> = [];
    const commandMetadata = {
      ...metadata,
      commands: [
        {
          id: commandId,
          extensionId,
          title: "Inspect",
          params: { files: { type: "files", required: true } },
        },
      ],
    } satisfies WorkbenchExtensionMetadata;
    registerWorkbenchExtensionContributions({
      executeCommand: () => [],
      metadata: commandMetadata,
      prepareCommandArgs: (targetCommandId, args, _context, onArgsChange) => {
        preparedCalls.push({ commandId: targetCommandId, args });
        const nextArgs = { files: ["uploaded-file"] };
        onArgsChange?.(nextArgs);
        return nextArgs;
      },
      projectId: "project-1",
      workbench,
    });
    const prepared = await workbench.commands.prepareCommandArgs(
      commandId,
      { files: ["browser-file"] },
      undefined,
      (args) => argumentChanges.push(args),
    );
    expect(preparedCalls).toEqual([{ commandId, args: { files: ["browser-file"] } }]);
    expect(argumentChanges).toEqual([{ files: ["uploaded-file"] }]);
    expect(prepared).toEqual({ files: ["uploaded-file"] });
  });
});
describe("registerWorkbenchExtensionContributions workbench surfaces", () => {
  test("registers extension views, placements, status chrome, and settings", async () => {
    const workbench = createWorkbench();
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.views.registerView({ id: "start", title: "Start", body: { kind: "react", render: () => null } });
    const startPage = { extensionId: "pstdio", kind: "page" as const, id: "start" };
    workbench.pages.registerPage({
      id: "start",
      ref: startPage,
      title: "Start",
      path: "",
      modeId: "project",
      main: {
        kind: "view",
        view: {
          kind: "view",
          id: "start",
        },
        cardinality: "one",
      },
      slots: [],
    });
    const calls: string[] = [];
    const module: WorkbenchModuleContribution = {
      id: "test.extension-host",
      activate: (ctx) =>
        registerWorkbenchExtensionContributions({
          executeCommand: (commandId) => {
            calls.push(commandId);
            return [];
          },
          metadata,
          projectId: "project-1",
          workbench: ctx,
        }),
    };
    workbench.registerModule(module);
    workbench.pageLocations.setProject("project-1");
    workbench.pageLocations.navigate({
      kind: "page",
      page: { extensionId, kind: "page", id: "review" },
    });
    expect(workbench.views.getView(treeViewId)?.id).toBe(treeViewId);
    expect(getWorkbenchRenderers(workbench).getTreeRenderer(treeViewId)).toBeDefined();
    expect(getWorkbenchRenderers(workbench).getControlsRenderer(controlsViewId)).toBeDefined();
    expect(workbench.viewMenus.getViewMenu(`${extensionId}.view-menu.review-outline`)).toMatchObject({
      ownerViewId: controlsViewId,
      viewId: treeViewId,
      side: "left",
      priority: 1000000,
    });
    expect(workbench.layout.listPanelInstances("main")).toContainEqual(
      expect.objectContaining({
        panelId: `workbench.mode-placement.${extensionId}.placement.outline`,
        viewId: treeViewId,
        closable: true,
      }),
    );
    expect(workbench.statusBar.listItems()).toEqual([
      expect.objectContaining({
        id: `${extensionId}.status-bar-item.sync-status`,
        viewId: statusViewId,
        popoverViewId: statusViewId,
        slot: "trailing",
      }),
    ]);
    expect(workbench.statusBar.listVisibleItems()).toHaveLength(1);
    workbench.pageLocations.navigate({ kind: "page", page: startPage });
    expect(workbench.statusBar.listVisibleItems()).toHaveLength(0);
    workbench.pageLocations.navigate({
      kind: "page",
      page: { extensionId, kind: "page", id: "review" },
    });
    expect(workbench.views.getView(statusViewId)).toBeDefined();
    expect(workbench.layout.getWidget(statusViewId)).toBeUndefined();
    expect(workbench.layout.listPanelInstances().some((panel) => panel.panelId === statusViewId)).toBe(false);
  });
});

test.each([
  "review",
  "alternate",
  "root",
])("projects only the shared view tab’s own navigation: %s", async (selected) => {
  const workbench = createWorkbench();
  workbench.pageLocations.setProject("resource-menus");
  const resource = { type: "artifact", id: "ticket-a", extensionId, projectId: "resource-menus" };
  const source: WorkbenchExtensionMetadata = {
    ...metadata,
    pages: [
      { ...metadata.pages[0]!, id: `${extensionId}.page.root`, localId: "root", path: "root" },
      ...metadata.pages.flatMap((page) =>
        ["aaa-unlisted", "review", "alternate"].map((id) => ({
          ...page,
          id: `${extensionId}.page.${id}`,
          localId: id,
          path: id,
          parent: { kind: "page" as const, extensionId, id: "root" },
          resource: { kinds: [{ kind: "resource-kind" as const, extensionId, id: "artifact" }] },
        })),
      ),
    ],
    modes: metadata.modes.map((mode) => ({ ...mode, regions: ["main", "side"] })),
    placements: [
      ...metadata.placements,
      {
        id: `${extensionId}.placement.resource-reader`,
        localId: "resource-reader",
        extensionId,
        mode: { kind: "mode", extensionId, id: "review" },
        item: {
          kind: "binding",
          binding: {
            kinds: [{ kind: "resource-kind", extensionId, id: "artifact" }],
            cardinality: "many",
            view: { kind: "view", extensionId, id: "filters" },
          },
        },
        region: "side",
      },
    ],
    navigationTrees: ["review", "alternate"].map((id) => ({
      id: `${extensionId}.navigation-tree.${id}`,
      extensionId,
      owner: { kind: "page", extensionId, id },
      slot: "content",
      view: { kind: "view", extensionId, id: "outline" },
    })),
  };
  const registration = registerWorkbenchExtensionContributions({
    workbench,
    projectId: "resource-menus",
    metadata: source,
    executeCommand: (_command, body) => [
      { id: "files", nodes: [{ id: "file", label: body.resource?.id ?? "unbound" }] },
    ],
  });
  try {
    const menu = workbench.viewMenus.listViewMenus(controlsViewId).find((entry) => entry.purpose === "resources");
    expect(menu).toMatchObject({ side: "right", ownerViewId: controlsViewId });
    workbench.modes.setActiveMode(modeId);
    const reader = workbench.layout.listWidgets().find((widget) => widget.id.endsWith(".resource-reader"));
    expect(reader?.ownedPanelMenuIds?.some((id) => id.includes("resources"))).toBe(true);
    const routed = workbench.pages.store.getState().location;
    const sections = await getWorkbenchRenderers(workbench).getBody(menu!.viewId, { resource });
    expect(sections.flatMap((section) => section.nodes).map((node) => node.label)).toEqual(["ticket-a"]);
    expect(workbench.pages.store.getState().location).toBe(routed);
    workbench.layout.openWidget(reader!.id, {
      resource,
      pageContext: { page: { kind: "page", extensionId, id: selected } },
    });
    const visible = resolvePanelMenuRegionState(workbench, "side-right-menu").widgets.map((entry) => entry.viewId);
    if (selected === "root") expect(visible).toHaveLength(1);
    else expect(visible).toEqual([`${extensionId}.page.${selected}:resources`]);
  } finally {
    registration.dispose();
    await workbench.dispose();
  }
});

test("a page exposes Activity for a resource kind owned by another extension", () => {
  const workbench = createWorkbench();
  workbench.resources.registerKind({
    kind: "record",
    label: "Record",
    extensionId: "foreign",
    activity: { api: createMemoryActivity(), capabilities: { comments: true }, watch: async () => {} },
  });
  const source: WorkbenchExtensionMetadata = {
    ...metadata,
    pages: [
      { ...metadata.pages[0]!, id: `${extensionId}.page.root`, localId: "root", path: "root" },
      ...metadata.pages.map((page) => ({
        ...page,
        parent: { kind: "page" as const, extensionId, id: "root" },
        resource: { kinds: [{ kind: "resource-kind" as const, extensionId: "foreign", id: "record" }] },
      })),
    ],
  };
  const registration = registerWorkbenchExtensionContributions({
    workbench,
    projectId: "resource-menus",
    metadata: source,
    executeCommand: () => undefined,
  });
  try {
    expect(workbench.viewMenus.listViewMenus(controlsViewId).find((menu) => menu.purpose === "activity")).toMatchObject(
      { side: "right", ownerViewId: controlsViewId },
    );
  } finally {
    registration.dispose();
  }
});

test("uses the shared create declaration for the command's other entry points", async () => {
  const queries = createScopedQueryClient({ runtimeId: "dashboard", extensionId: "pstdio" });
  const workbench = createWorkbench({ queries });
  const operations = getWorkbenchOperations(queries);
  const commandId = `${extensionId}.command.create-folder`;
  const registration = registerWorkbenchExtensionContributions({
    metadata: {
      ...metadata,
      commands: [{ id: commandId, extensionId, title: "Create folder" }],
      keybindings: [
        {
          id: `${extensionId}.keybinding.create-folder`,
          extensionId,
          layer: "create",
          action: { kind: "command", target: { command: { kind: "command", id: "create-folder", extensionId } } },
          key: "F",
          canonicalChord: "F",
          parsed: { key: "F", ctrl: false, shift: false, alt: false, meta: false, modifiers: [] },
        },
      ],
    },
    projectId: "project",
    queries,
    workbench,
    executeCommand: () => {
      throw new PstdioConnectionError(new Error("Response lost"));
    },
  });
  try {
    await expect(workbench.commands.executeCommand(commandId, { name: "Draft folder" })).rejects.toMatchObject({
      name: "UnresolvedSubmissionError",
    });
    expect(operations.getSnapshot().recovery[0]).toMatchObject({
      title: "Create folder",
      status: "unknown",
      draft: { name: "Draft folder" },
    });
  } finally {
    registration.dispose();
    await workbench.dispose();
    queries.dispose();
  }
});
