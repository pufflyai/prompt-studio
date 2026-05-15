import { describe, expect, it } from "bun:test";
import type { CommandExecuteRequest, DashboardExtensionMetadata } from "pstdio-api-contracts";
import { BRIDGE_WEBVIEW_RENDERER_ID } from "pstdio-extensions/shell";
import { PROJECT_NAVIGATION_TREE_ID } from "./dashboard-project-navigation";
import {
  createDashboardShell,
  DASHBOARD_MODE_IDS,
  dashboardExtensionModuleId,
  EXTENSION_ROUTE_RESOURCE_KIND,
} from "./dashboard-shell";
import { DASHBOARD_COMMAND_PALETTE_MENU } from "./menu-locations";
import { applyRouteActivation, resolveRouteActivation } from "./tanstack-shell-adapter";

const extensionId = "pstdio.extension-lab";

const createMetadata = (): DashboardExtensionMetadata => ({
  diagnostics: [],
  extensions: [
    {
      id: extensionId,
      name: "extension-lab",
      displayName: "Extension Lab",
      sourcePath: "/extensions/extension-lab/extension.ts",
      version: "1.0.0",
    },
  ],
  commands: [
    {
      id: "extension-lab.say-hello",
      extensionId,
      title: "Say hello",
      description: "Greet the active project",
    },
  ],
  menuContributions: [
    {
      id: "extension-lab.say-hello.commandPanel",
      extensionId,
      commandId: "extension-lab.say-hello",
      slotId: "project.commandPanel",
      label: "Say hello",
    },
    {
      id: "extension-lab.say-hello.headerPrimary",
      extensionId,
      commandId: "extension-lab.say-hello",
      slotId: "project.headerPrimary",
      label: "Lab: Say hello",
    },
    {
      id: "extension-lab.say-hello.headerOverflow",
      extensionId,
      commandId: "extension-lab.say-hello",
      slotId: "project.headerOverflow",
      label: "Say hello",
    },
  ],
  navigation: [
    {
      id: "extension-lab.labPage.nav",
      extensionId,
      slotId: "project.sidebarNav",
      label: "Lab",
      icon: "flask-conical",
      route: "lab",
    },
  ],
  routes: [
    {
      id: "extension-lab.labPage",
      extensionId,
      path: "lab",
      label: "Lab",
      webview: {
        entry: { kind: "package-asset", path: "./src/main.tsx", baseUrl: "file:///extension-lab/" },
        capabilities: ["commands.execute", "notification.show"],
        runtimeUrl: "/extensions/extension-lab/runtime.html",
        moduleUrl: "/extensions/extension-lab/module.js",
      },
    },
  ],
  settingsPanels: [],
  views: [],
});

const createInMemoryStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
};

describe("dashboard extension modules", () => {
  it("maps extension metadata into shell module contributions", async () => {
    const navigations: string[] = [];
    const commandRequests: Array<{ commandId: string; body: CommandExecuteRequest }> = [];
    const shell = createDashboardShell({
      storage: createInMemoryStorage(),
      navigate: (path) => navigations.push(path),
    });

    shell.syncExtensionModules({
      projectId: "proj-1",
      metadata: createMetadata(),
      executeCommand: async (input) => {
        commandRequests.push(input);
        return { outcome: { status: "ok" } };
      },
      resolveAssetUrl: (path) => `https://api.local${path}`,
    });

    expect(shell.commands.getCommand("extension-lab.say-hello")).toMatchObject({
      source: "extension",
      ownerId: extensionId,
      command: {
        category: "Extension Lab",
        label: "Say hello",
      },
    });
    expect(shell.resources.getKind(EXTENSION_ROUTE_RESOURCE_KIND)).toMatchObject({
      source: "module",
      ownerId: "dashboard.extensions",
    });
    expect(shell.layout.getWidget("extension-lab.labPage")).toMatchObject({
      source: "extension",
      ownerId: extensionId,
      rendererId: BRIDGE_WEBVIEW_RENDERER_ID,
      config: {
        runtimeUrl: "https://api.local/extensions/extension-lab/runtime.html",
        moduleUrl: "https://api.local/extensions/extension-lab/module.js",
      },
    });

    const commandPanelAction = shell.menus
      .listMenuActions(DASHBOARD_COMMAND_PALETTE_MENU)
      .find((action) => action.commandId === "extension-lab.say-hello");

    expect(commandPanelAction).toMatchObject({
      source: "extension",
      ownerId: extensionId,
      label: "Say hello",
    });

    await shell.commands.executeCommand("extension-lab.say-hello", commandPanelAction?.args);

    expect(commandRequests[0]).toMatchObject({
      commandId: "extension-lab.say-hello",
      body: {
        projectId: "proj-1",
        slot: { id: "project.commandPanel", kind: "menu" },
        source: "dashboard",
      },
    });

    applyRouteActivation(shell, resolveRouteActivation({ pathname: "/projects/proj-1/tickets" }));

    expect(shell.modes.getActiveModeId()).toBe(DASHBOARD_MODE_IDS.projectNavigation);
    const sections = await shell.trees.getSections(PROJECT_NAVIGATION_TREE_ID);
    expect(sections.flatMap((section) => section.nodes).map((node) => node.resource?.uri)).toContain(
      "pstdio://project/proj-1/extension/lab",
    );

    await shell.resources.openResource({
      kind: EXTENSION_ROUTE_RESOURCE_KIND,
      uri: "pstdio://project/proj-1/extension/lab",
      id: "extension-lab.labPage",
      label: "Lab",
    });

    expect(navigations).toContain("/projects/proj-1/extensions/lab");

    shell.unregisterModule(dashboardExtensionModuleId(extensionId));

    expect(shell.commands.getCommand("extension-lab.say-hello")).toBeUndefined();
    expect(shell.layout.getWidget("extension-lab.labPage")).toBeUndefined();
    expect(
      (await shell.trees.getSections(PROJECT_NAVIGATION_TREE_ID))
        .flatMap((section) => section.nodes)
        .map((node) => node.resource?.uri),
    ).not.toContain("pstdio://project/proj-1/extension/lab");
  });
});
