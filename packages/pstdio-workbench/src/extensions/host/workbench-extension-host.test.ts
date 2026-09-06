import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbench, getWorkbenchRenderers, type WorkbenchModuleContribution } from "../../core";
import { buildSettingsTreeBody } from "../../react/settings/settings-tree";
import { registerWorkbenchExtensionContributions } from "./workbench-extension-host";

const extensionId = "pstdio.lab";
const modeId = `${extensionId}.mode.review`;
const treeViewId = `${extensionId}.view.outline`;
const controlsViewId = `${extensionId}.view.filters`;
const detailViewId = `${extensionId}.view.detail`;
const statusViewId = `${extensionId}.view.sync-status`;
const statusesId = `${extensionId}.status.workflow`;
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
      slot: { id: "workbench.statusBar.trailing" },
      order: 20,
      when: { mode: { extensionId, kind: "mode", id: "review" } },
    },
  ],
  statuses: [
    {
      id: statusesId,
      localId: "workflow",
      extensionId,
      title: "Workflow",
      queryHandlerId: `${statusesId}.query`,
    },
  ],
  settingsPanels: [],
  diagnostics: [],
} satisfies WorkbenchExtensionMetadata;
describe("registerWorkbenchExtensionContributions", () => {
  test("groups extension settings by owner and keeps statuses in the Project section", async () => {
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
      { label: "Project", nodes: ["Extensions", "Repositories", "Statuses", "Danger zone"] },
      { label: "Lab", nodes: ["Alpha settings", "Filters", "Zebra settings"] },
    ]);
    expect(workbench.settings.getPanel("workbench.statuses")).toMatchObject({
      icon: "list-checks",
      order: 25,
      section: "project",
    });
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
  test("registers alpha.4 views, placements, status chrome, and workflow statuses", async () => {
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
            if (commandId.endsWith(".query")) {
              return { statuses: [{ id: "todo", label: "Todo", color: "blue", sortOrder: 0 }] };
            }
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
        closable: false,
      }),
    );
    expect(workbench.statusBar.listItems()).toEqual([
      expect.objectContaining({
        id: `${extensionId}.status-bar-item.sync-status`,
        viewId: statusViewId,
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
    await expect(workbench.statuses.query(statusesId)).resolves.toEqual([
      { id: "todo", label: "Todo", color: "blue", sortOrder: 0 },
    ]);
    expect(calls).toContain(`${statusesId}.query`);
  });
});
