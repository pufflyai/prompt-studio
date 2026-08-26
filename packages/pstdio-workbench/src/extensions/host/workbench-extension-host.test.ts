import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbenchCore, type WorkbenchModuleContribution } from "../../core";
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
  modes: [{ id: modeId, localId: "review", extensionId, label: "Review" }],
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
  viewMenus: [],
  placements: [
    {
      id: `${extensionId}.placement.outline`,
      localId: "outline",
      extensionId,
      mode: { extensionId, kind: "mode", id: "review" },
      item: { kind: "view", view: { extensionId, kind: "view", id: "outline" } },
      region: "main",
      defaultOpen: true,
      required: true,
    },
    {
      id: `${extensionId}.placement.detail`,
      localId: "detail",
      extensionId,
      mode: { extensionId, kind: "mode", id: "review" },
      item: {
        kind: "resource-slot",
        slot: {
          resourceKind: { extensionId, kind: "resource-kind", id: "artifact" },
          id: "inspector",
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
      surface: "attached",
      label: "Artifact",
      slots: [{ id: "inspector", cardinality: "many", access: "public" }],
    },
  ],
  resourceViews: [
    {
      id: `${extensionId}.resource-view.detail`,
      extensionId,
      resourceKind: { extensionId, kind: "resource-kind", id: "artifact" },
      slot: {
        resourceKind: { extensionId, kind: "resource-kind", id: "artifact" },
        id: "inspector",
      },
      view: { extensionId, kind: "view", id: "detail" },
    },
  ],
  navigationItems: [],
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
    const workbench = createWorkbenchCore();
    workbench.settings.registerSection({ id: "workbench", title: "Workbench", order: 10 });
    workbench.settings.registerSection({ id: "project", title: "Project", order: 20 });
    workbench.settings.registerPanel({
      id: "host.extensions",
      title: "Extensions",
      kind: "custom",
      order: 10,
      section: "project",
      render: () => null,
    });
    workbench.settings.registerPanel({
      id: "host.repositories",
      title: "Repositories",
      kind: "custom",
      order: 20,
      section: "project",
      render: () => null,
    });
    workbench.settings.registerPanel({
      id: "host.danger",
      title: "Danger zone",
      kind: "custom",
      order: 90,
      section: "project",
      render: () => null,
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

    const tree = await buildSettingsTreeBody({ settings: workbench.settings, hasProjectScope: true });
    expect(tree.map((section) => ({ label: section.label, nodes: section.nodes.map((node) => node.label) }))).toEqual([
      { label: "Project", nodes: ["Extensions", "Repositories", "Statuses", "Danger zone"] },
      { label: "Lab", nodes: ["Alpha settings", "Zebra settings"] },
    ]);
    expect(workbench.settings.getPanel("workbench.statuses")).toMatchObject({
      icon: "list-checks",
      order: 25,
      section: "project",
    });
  });

  test("prepares extension command arguments through the host adapter", async () => {
    const workbench = createWorkbenchCore();
    const commandId = `${extensionId}.command.inspect`;
    const argumentChanges: unknown[] = [];
    const preparedCalls: Array<{ commandId: string; args: unknown }> = [];
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

  test("registers alpha.4 views, placements, status chrome, and workflow statuses", async () => {
    const workbench = createWorkbenchCore();
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    const calls: string[] = [];
    const openedViews: string[] = [];
    const preparedResources: string[] = [];
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
          prepareResource: (resource) => preparedResources.push(resource.uri),
          projectId: "project-1",
          resolveViewInput: (view) => (openInput) => {
            openedViews.push(view.id);
            return openInput;
          },
          workbench: ctx,
        }),
    };

    workbench.registerModule(module);
    workbench.modes.setActiveMode(modeId);

    expect(workbench.views.getView(treeViewId)?.panelId).toBe(treeViewId);
    expect(workbench.renderers.getTreeRenderer(treeViewId)).toBeDefined();
    expect(workbench.renderers.getControlsRenderer(controlsViewId)).toBeDefined();
    expect(workbench.layout.listPanelInstances("main")).toContainEqual(
      expect.objectContaining({ panelId: treeViewId, closable: false }),
    );
    expect(workbench.statusBar.listItems()).toEqual([
      expect.objectContaining({
        id: `${extensionId}.status-bar-item.sync-status`,
        viewId: statusViewId,
        slot: "trailing",
      }),
    ]);
    expect(workbench.statusBar.listVisibleItems()).toHaveLength(1);
    workbench.modes.setActiveMode("project");
    expect(workbench.statusBar.listVisibleItems()).toHaveLength(0);
    workbench.modes.setActiveMode(modeId);
    expect(workbench.views.getView(statusViewId)).toBeDefined();
    expect(workbench.layout.getWidget(statusViewId)).toBeDefined();
    expect(workbench.layout.listPanelInstances().some((panel) => panel.panelId === statusViewId)).toBe(false);

    await workbench.views.openView(detailViewId);
    expect(openedViews).toEqual([detailViewId]);

    workbench.sidePanel.setMode("closed");
    await workbench.resources.openResource({
      kind: "artifact",
      uri: "pstdio://artifact/artifact-1",
      id: "artifact-1",
      label: "Artifact 1",
    });
    expect(preparedResources).toEqual(["pstdio://artifact/artifact-1"]);
    expect(workbench.sidePanel.getMode()).toBe("attached");

    await expect(workbench.statuses.query(statusesId)).resolves.toEqual([
      { id: "todo", label: "Todo", color: "blue", sortOrder: 0 },
    ]);
    expect(calls).toContain(`${statusesId}.query`);
  });
});
