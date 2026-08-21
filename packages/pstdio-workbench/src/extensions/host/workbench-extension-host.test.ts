import { describe, expect, test } from "bun:test";
import type { CommandExecuteRequest, CommandExecuteResponse, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbenchCore, type MenuPath, workbenchCommandPaletteMenuPath } from "../../core";
import { BRIDGE_WEBVIEW_RENDERER_ID } from "../bridge/bridge-webview-renderer";
import { registerWorkbenchExtensionContributions } from "./workbench-extension-host";

const success = (commandId: string, value: unknown): CommandExecuteResponse => ({
  commandId,
  extensionId: "pstdio.lab",
  outcome: { ok: true, status: "success", value },
});

const webview = {
  entry: { kind: "package-asset" as const, path: "./ticket.tsx", baseUrl: "file:///extension/extension.ts" },
  runtimeUrl: "/runtime.html",
  moduleUrl: "/ticket.js",
  styles: ["/ticket.css"],
};

const metadata = {
  extensions: [{ id: "pstdio.lab", name: "lab", displayName: "Lab", sourcePath: "/extension/extension.ts" }],
  commands: [
    { id: "lab.open", extensionId: "pstdio.lab", title: "Open lab" },
    {
      id: "lab.create",
      extensionId: "pstdio.lab",
      title: "Create lab item",
      params: {
        title: { type: "text", label: "Title" },
        amount: { type: "number", defaultValue: 1 },
      },
    },
    { id: "lab.queryRows", extensionId: "pstdio.lab", title: "Query rows" },
    { id: "lab.updateRow", extensionId: "pstdio.lab", title: "Update row" },
  ],
  diagnostics: [],
  menuContributions: [
    {
      id: "lab.open.menu",
      extensionId: "pstdio.lab",
      commandId: "lab.open",
      slotId: "project.headerPrimary",
      label: "Open lab",
      params: { source: "menu" },
    },
  ],
  commandPaletteContributions: [
    {
      id: "lab.open.palette",
      extensionId: "pstdio.lab",
      commandId: "lab.open",
      label: "Open lab",
      group: "Lab",
      params: { source: "palette" },
    },
  ],
  modes: [
    {
      id: "lab.review",
      extensionId: "pstdio.lab",
      modeId: "lab.review",
      label: "Review",
      panelRegions: ["main", "side"],
      resources: {
        ticket: {
          slots: {
            primary: { region: "main", required: true },
            auxiliary: { region: "side" },
          },
        },
      },
    },
  ],
  resourceKinds: [
    {
      id: "ticket",
      extensionId: "pstdio.lab",
      surface: "primary",
      slots: {
        primary: { cardinality: "one", external: false },
        auxiliary: { cardinality: "many", external: true },
      },
    },
  ],
  resourcePanels: [
    {
      id: "lab.ticketPanel",
      extensionId: "pstdio.lab",
      resourceKind: "ticket",
      panel: "lab.ticketPanel",
      slot: "primary",
    },
    { id: "lab.rows", extensionId: "pstdio.lab", resourceKind: "ticket", panel: "lab.rows", slot: "auxiliary" },
    {
      id: "lab.ticketModal",
      extensionId: "pstdio.lab",
      resourceKind: "ticket",
      panel: "lab.ticketModal",
      slot: "auxiliary",
    },
  ],
  routes: [
    {
      id: "lab.details",
      extensionId: "pstdio.lab",
      path: "details",
      label: "Details",
      webview: { ...webview, moduleUrl: "/details.js" },
    },
  ],
  settingsDefinitions: [
    {
      key: "lab.enabled",
      extensionId: "pstdio.lab",
      type: "boolean",
      scope: "project",
      default: true,
      description: "Enable lab",
    },
  ],
  settingsPanels: [
    {
      id: "lab.settings",
      extensionId: "pstdio.lab",
      slotId: "project.settingsPanels",
      scope: "project",
      title: "Lab settings",
      webview: { ...webview, moduleUrl: "/settings.js" },
    },
  ],
  treeItems: [],
  treeRenderers: [],
  kanbanRenderers: [
    {
      id: "lab.rows",
      extensionId: "pstdio.lab",
      title: "Rows",
      resourceKind: "ticket",
      attributes: [{ id: "status", label: "Status", type: { kind: "string" }, editable: true }],
      queryHandlerId: "lab.rows.query",
      attributeChangeHandlerId: "lab.rows.onAttributeChange",
    },
  ],
  panels: [
    {
      id: "lab.rows",
      extensionId: "pstdio.lab",
      show: { region: "main", allowedRegions: ["main", "side"] },
      title: "Rows",
      renderer: { kind: "kanban", id: "lab.rows" },
    },
    {
      id: "lab.ticketPanel",
      extensionId: "pstdio.lab",
      show: { region: "main" },
      title: "Ticket",
      webview,
    },
    {
      id: "lab.ticketModal",
      extensionId: "pstdio.lab",
      show: { region: "side" },
      title: "Ticket modal",
      webview: { ...webview, moduleUrl: "/ticket-modal.js" },
    },
  ],
} satisfies WorkbenchExtensionMetadata;

const registerOwnedShowForPresenter = async () => {
  const workbench = createWorkbenchCore();
  const showOnlyMetadata = {
    ...metadata,
    resourcePanels: [],
    modes: [
      {
        ...metadata.modes[0],
        resources: { ticket: { panels: { "lab.ticketPanel": { region: "main", required: true } } } },
      },
    ],
    panels: metadata.panels.map((panel) =>
      panel.id === "lab.ticketPanel" ? { ...panel, show: { for: "ticket", region: "main" as const } } : panel,
    ),
  } satisfies WorkbenchExtensionMetadata;

  registerWorkbenchExtensionContributions({
    executeCommand: async (commandId) => success(commandId, undefined),
    metadata: showOnlyMetadata,
    projectId: "project-1",
    workbench,
  });

  await workbench.resources.openResource({
    kind: "ticket",
    uri: "workbench://ticket/T-1",
    id: "T-1",
    label: "T-1",
  });

  expect(workbench.layout.listPanelInstances("main")).toEqual([
    expect.objectContaining({ panelId: "lab.ticketPanel", resourceUri: "workbench://ticket/T-1" }),
  ]);
};

describe("registerWorkbenchExtensionContributions", () => {
  test("registers workbench-facing contributions and command-backed callbacks", async () => {
    const workbench = createWorkbenchCore();
    const calls: { commandId: string; request: CommandExecuteRequest }[] = [];
    const headerPath: MenuPath = ["project", "header", "primary"];

    registerWorkbenchExtensionContributions({
      executeCommand: async (commandId, request) => {
        calls.push({ commandId, request });
        if (commandId === "lab.rows.query") {
          return success(commandId, {
            rows: [{ id: "row-1", title: "Row 1", attributes: { status: "open" } }],
          });
        }
        return success(commandId, { ok: true });
      },
      menuSlotsById: new Map([["project.headerPrimary", { menuPath: headerPath }]]),
      metadata,
      projectId: "project-1",
      workbench,
    });

    expect(workbench.renderers.getRenderer(BRIDGE_WEBVIEW_RENDERER_ID)).toBeDefined();
    expect(workbench.layout.getPanel("lab.ticketPanel")).toMatchObject({
      region: "main",
      rendererId: BRIDGE_WEBVIEW_RENDERER_ID,
      config: expect.objectContaining({ moduleUrl: "/ticket.js" }),
    });
    expect(workbench.layout.getPanel("lab.ticketPanel")?.resourceKinds).toBeUndefined();
    expect(workbench.layout.getPanel("lab.ticketModal")).toMatchObject({
      region: "side",
      rendererId: BRIDGE_WEBVIEW_RENDERER_ID,
      config: expect.objectContaining({
        moduleUrl: "/ticket-modal.js",
      }),
    });
    expect(workbench.layout.getPanel("lab.ticketModal")?.resourceKinds).toBeUndefined();
    expect(workbench.commands.getCommand("lab.create")?.command.params).toEqual({
      title: { type: "text", label: "Title" },
      amount: { type: "number", defaultValue: 1 },
    });
    expect(workbench.settings.getPanel("lab.settings")).toMatchObject({
      kind: "custom",
      section: "extensions",
      scope: "project",
    });
    expect(workbench.preferences.getSchema("lab.enabled")).toMatchObject({ scope: "project", default: true });

    const renderer = workbench.renderers.getKanbanRenderer("lab.rows");
    expect(renderer).toMatchObject({ id: "lab.rows", title: "Rows" });
    expect(workbench.layout.getPanel("lab.rows")).toMatchObject({
      region: "main",
      rendererId: "lab.rows",
    });
    expect(workbench.layout.getPanel("lab.rows")?.resourceKinds).toBeUndefined();
    await expect(
      renderer?.executeQuery({
        settings: {
          viewMode: "list",
          columnGrouping: "none",
          rowGrouping: "none",
          ordering: { attributeId: "status", direction: "asc" },
          displayProperties: ["status"],
        },
        filters: {},
      }),
    ).resolves.toEqual([{ id: "row-1", title: "Row 1", attributes: { status: "open" } }]);
    renderer?.onAttributeChange?.("row-1", "status", "done");
    expect(calls.at(-1)).toMatchObject({
      commandId: "lab.rows.onAttributeChange",
      request: { params: { rowId: "row-1", attributeId: "status", value: "done" } },
    });

    const menuItem = workbench.layout.listMenuItems(headerPath)[0];
    expect(menuItem).toMatchObject({ commandId: "workbench.extension.menu.lab.open.menu" });
    await workbench.commands.executeCommand(menuItem!.commandId);
    expect(calls.at(-1)).toMatchObject({
      commandId: "lab.open",
      request: { params: { source: "menu" }, source: "dashboard" },
    });

    const paletteItem = workbench.layout
      .listMenuItems(workbenchCommandPaletteMenuPath)
      .find((item) => item.commandId === "workbench.extension.palette.lab.open.palette");
    expect(paletteItem).toMatchObject({ commandId: "workbench.extension.palette.lab.open.palette" });
    await workbench.commands.executeCommand(paletteItem!.commandId);
    expect(calls.at(-1)).toMatchObject({
      commandId: "lab.open",
      request: { params: { source: "palette" }, slot: { id: "workbench.commandPalette" } },
    });

    await workbench.resources.openResource({
      kind: "extension-route",
      uri: "workbench://extension-route/lab.details",
      id: "lab.details",
    });
    expect(workbench.layout.listPanelInstances("main").at(-1)).toMatchObject({ panelId: "lab.details" });

    await workbench.navigator.open({
      modeId: "lab.review",
      resource: { kind: "ticket", uri: "workbench://ticket/T-1", id: "T-1", label: "T-1" },
    });
    expect(workbench.layout.listPanelInstances("main").at(-1)).toMatchObject({ panelId: "lab.ticketPanel" });
    expect(workbench.layout.listPanelInstances("side").map((instance) => instance.panelId)).toEqual([
      "lab.rows",
      "lab.ticketModal",
    ]);
    expect(workbench.shell.getSidePanelPresentation()).toBe("attached");
  });

  test("registers a resource presenter for an owned show.for panel without a resourcePanels edge", async () => {
    await registerOwnedShowForPresenter();
  });

  test("keeps webview command executions in the extension command response envelope", async () => {
    const workbench = createWorkbenchCore();
    const calls: { commandId: string; request: CommandExecuteRequest }[] = [];
    const fileCalls: unknown[] = [];

    registerWorkbenchExtensionContributions({
      executeCommand: async (commandId, request) => {
        calls.push({ commandId, request });
        return success(commandId, { ok: true });
      },
      metadata,
      projectId: "project-1",
      webviewFiles: {
        upload: async (params) => {
          fileCalls.push(["upload", params]);
          return { id: "blob-1", name: "a.txt" };
        },
        list: async (params) => {
          fileCalls.push(["list", params]);
          return { files: [{ id: "blob-1", name: "a.txt" }] };
        },
        delete: async (params) => {
          fileCalls.push(["delete", params]);
        },
      },
      workbench,
    });

    const renderer = workbench.renderers.getRenderer(BRIDGE_WEBVIEW_RENDERER_ID);
    const widget = workbench.layout.getPanel("lab.ticketPanel")!;
    const element = renderer?.keepAlive
      ? null
      : (renderer?.render({
          refresh: () => {},
          panel: widget,
          workbench,
          instance: {
            instanceId: "lab.ticketPanel",
            resource: { kind: "ticket", uri: "pstdio://ticket/PS-16", id: "PS-16", label: "Ticket PS-16" },
            panelId: "lab.ticketPanel",
            closable: false,
          },
        }) as { props?: { capabilities?: Record<string, (params: unknown) => unknown> } } | null);

    await expect(
      element?.props?.capabilities?.["commands.execute"]?.({
        commandId: "lab.open",
        params: { source: "webview" },
      }),
    ).resolves.toEqual(success("lab.open", { ok: true }));
    expect(calls.at(-1)).toMatchObject({
      commandId: "lab.open",
      request: {
        params: { source: "webview" },
        projectId: "project-1",
        resource: { type: "ticket", id: "PS-16", label: "Ticket PS-16" },
        slot: { id: "lab.ticketPanel", kind: "panel" },
        source: "dashboard",
      },
    });
    await expect(element?.props?.capabilities?.["files.upload"]?.({ name: "a.txt" })).resolves.toEqual({
      id: "blob-1",
      name: "a.txt",
    });
    await expect(
      element?.props?.capabilities?.["files.list"]?.({ scope: { type: "resource", id: "PS-16" } }),
    ).resolves.toEqual({
      files: [{ id: "blob-1", name: "a.txt" }],
    });
    await expect(element?.props?.capabilities?.["files.delete"]?.({ id: "blob-1" })).resolves.toBeUndefined();
    expect(fileCalls).toEqual([
      ["upload", { name: "a.txt" }],
      ["list", { scope: { type: "resource", id: "PS-16" } }],
      ["delete", { id: "blob-1" }],
    ]);
  });

  test("merges webview host capability overrides over extension command capabilities", async () => {
    const workbench = createWorkbenchCore();
    const calls: { commandId: string; request: CommandExecuteRequest }[] = [];

    registerWorkbenchExtensionContributions({
      createWebviewHostCapabilityOverrides: () => ({
        "preferences.get": () => "pstdio-dark",
      }),
      executeCommand: async (commandId, request) => {
        calls.push({ commandId, request });
        return success(commandId, { ok: true });
      },
      metadata,
      projectId: "project-1",
      workbench,
    });

    const renderer = workbench.renderers.getRenderer(BRIDGE_WEBVIEW_RENDERER_ID);
    const widget = workbench.layout.getPanel("lab.ticketPanel")!;
    const element = renderer?.keepAlive
      ? null
      : (renderer?.render({
          refresh: () => {},
          panel: widget,
          workbench,
          instance: {
            instanceId: "lab.ticketPanel",
            resource: { kind: "ticket", uri: "pstdio://ticket/PS-16", id: "PS-16", label: "Ticket PS-16" },
            panelId: "lab.ticketPanel",
            closable: false,
          },
        }) as { props?: { capabilities?: Record<string, (params: unknown) => unknown> } } | null);

    expect(element?.props?.capabilities?.["preferences.get"]?.({ name: "dashboard.themePreference" })).toBe(
      "pstdio-dark",
    );
    await element?.props?.capabilities?.["commands.execute"]?.({ commandId: "lab.open" });
    expect(calls.at(-1)).toMatchObject({ commandId: "lab.open" });
  });
});
