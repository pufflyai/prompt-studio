import { describe, expect, it } from "bun:test";
import type { DashboardExtensionRouteRecord } from "pstdio-api-contracts";
import { BRIDGE_WEBVIEW_RENDERER_ID } from "pstdio-extensions/shell";
import {
  createDashboardExtensionRouteShell,
  createExtensionRouteResource,
  EXTENSION_ROUTE_OPEN_COMMAND_ID,
  EXTENSION_ROUTE_RESOURCE_KIND,
  EXTENSION_ROUTE_TREE_ID,
  EXTENSION_ROUTE_WIDGET_ID,
} from "./dashboard-extension-route-shell";
import { DASHBOARD_COMMAND_PALETTE_MENU } from "./menu-locations";

const labRoute: DashboardExtensionRouteRecord = {
  id: "extension-lab.labPage",
  extensionId: "extension-lab",
  path: "lab",
  label: "Lab page",
  webview: {
    entry: { kind: "package-asset", path: "index.tsx", baseUrl: "https://ext.local/" },
    capabilities: ["commands.execute", "preferences.set"],
    runtimeUrl: "/extensions/runtime.html",
    moduleUrl: "/extensions/module.js",
    styles: ["/extensions/styles.css"],
  },
};

const faultyRoute: DashboardExtensionRouteRecord = {
  ...labRoute,
  id: "extension-lab.faultyPage",
  path: "lab-faulty",
  label: "Faulty page",
};

const setup = () => {
  const navigations: string[] = [];
  const shell = createDashboardExtensionRouteShell({
    projectId: "proj-1",
    projectName: "Demo project",
    route: labRoute,
    getRoutes: () => [labRoute, faultyRoute],
    navigate: (path) => navigations.push(path),
    resolveAssetUrl: (path) => path,
    createWebviewHostCapabilities: () => ({}),
    createWebviewProps: () => ({}),
  });

  return { navigations, shell };
};

describe("createDashboardExtensionRouteShell", () => {
  it("registers the extension route shell slice and opens the active route", async () => {
    const { navigations, shell } = setup();

    expect(shell.resources.getKind(EXTENSION_ROUTE_RESOURCE_KIND)?.source).toBe("module");
    expect(shell.layout.getWidget(EXTENSION_ROUTE_WIDGET_ID)).toMatchObject({
      area: "main",
      rendererId: BRIDGE_WEBVIEW_RENDERER_ID,
    });
    expect(shell.layout.getWidget(EXTENSION_ROUTE_WIDGET_ID)?.config).toMatchObject({
      capabilities: ["commands.execute", "preferences.set"],
      runtimeUrl: "/extensions/runtime.html",
      moduleUrl: "/extensions/module.js",
    });
    expect(shell.trees.getTreeView(EXTENSION_ROUTE_TREE_ID)).toMatchObject({ area: "left", icon: "Puzzle" });
    expect(shell.commands.getCommand(EXTENSION_ROUTE_OPEN_COMMAND_ID)?.command.label).toBe("Lab page");
    expect(shell.menus.listMenuActions(DASHBOARD_COMMAND_PALETTE_MENU).map((action) => action.commandId)).toContain(
      EXTENSION_ROUTE_OPEN_COMMAND_ID,
    );

    expect(shell.layout.getLayout().activeWidgetId).toBe(EXTENSION_ROUTE_WIDGET_ID);
    expect(shell.layout.getLayout().activeResourceUri).toBe("pstdio://project/proj-1/extension/lab");

    const sections = await shell.trees.getSections(EXTENSION_ROUTE_TREE_ID);
    expect(sections.flatMap((section) => section.nodes).map((node) => node.resource?.uri)).toEqual([
      "pstdio://project/proj-1/extension/lab",
      "pstdio://project/proj-1/extension/lab-faulty",
    ]);

    await shell.resources.openResource(createExtensionRouteResource("proj-1", faultyRoute));
    expect(navigations).toContain("/projects/proj-1/extensions/lab-faulty");

    shell.dispose();
    expect(shell.commands.getCommand(EXTENSION_ROUTE_OPEN_COMMAND_ID)).toBeUndefined();
  });
});
