import type { DashboardExtensionRouteRecord } from "pstdio-api-contracts";
import {
  BRIDGE_WEBVIEW_RENDERER_ID,
  type BridgeWebviewConfig,
  type CreateBridgeWebviewHostCapabilities,
  type CreateBridgeWebviewProps,
} from "pstdio-extensions/shell";
import type { ResourceRef, ShellModuleContribution } from "pstdio-shell/core";
import { EXTENSION_ROUTE_RESOURCE_KIND } from "./dashboard-extension-modules";
import { createDashboardProjectShell } from "./dashboard-project-shell";
import { DASHBOARD_COMMAND_PALETTE_MENU } from "./menu-locations";

export const EXTENSION_ROUTE_WIDGET_ID = "extension.route";
export const EXTENSION_ROUTE_TREE_ID = "extension.navigation";
export const EXTENSION_ROUTE_OPEN_COMMAND_ID = "extension.openRoute";
export { EXTENSION_ROUTE_RESOURCE_KIND };

const EXTENSION_ROUTE_ICON = "Puzzle";

interface CreateDashboardExtensionRouteShellInput {
  projectId: string;
  projectName: string;
  route: DashboardExtensionRouteRecord;
  // Read lazily by the navigation tree so it reflects the latest fetched metadata.
  getRoutes: () => DashboardExtensionRouteRecord[];
  navigate: (path: string) => void;
  // Resolves API-served webview asset paths to absolute URLs (host concern — e.g. buildApiUrl).
  resolveAssetUrl: (path: string) => string;
  createWebviewHostCapabilities: CreateBridgeWebviewHostCapabilities;
  createWebviewProps: CreateBridgeWebviewProps;
}

export const createExtensionRouteResource = (projectId: string, route: DashboardExtensionRouteRecord): ResourceRef => ({
  kind: EXTENSION_ROUTE_RESOURCE_KIND,
  uri: `pstdio://project/${projectId}/extension/${route.path}`,
  id: route.id,
  label: route.label,
  icon: EXTENSION_ROUTE_ICON,
  metadata: { projectId, routePath: route.path, widgetId: EXTENSION_ROUTE_WIDGET_ID },
});

// Resolve API-served webview asset URLs the same way the dashboard does for every other
// extension surface, so the bridge runtime loads from the running API.
const buildExtensionWebviewConfig = (
  webview: DashboardExtensionRouteRecord["webview"],
  resolveAssetUrl: (path: string) => string,
): BridgeWebviewConfig => ({
  title: webview.title,
  capabilities: webview.capabilities,
  runtimeUrl: resolveAssetUrl(webview.runtimeUrl),
  moduleUrl: resolveAssetUrl(webview.moduleUrl),
  styles: webview.styles?.map(resolveAssetUrl),
});

const createDashboardExtensionRouteModule = (input: CreateDashboardExtensionRouteShellInput) =>
  ({
    id: "dashboard.extensionRoute",
    activate(ctx) {
      const activeResource = createExtensionRouteResource(input.projectId, input.route);

      return [
        ctx.layout.registerWidget({
          id: EXTENSION_ROUTE_WIDGET_ID,
          title: input.route.label,
          area: "main",
          singleton: true,
          resourceKinds: [EXTENSION_ROUTE_RESOURCE_KIND],
          rendererId: BRIDGE_WEBVIEW_RENDERER_ID,
          config: buildExtensionWebviewConfig(input.route.webview, input.resolveAssetUrl),
        }),
        ctx.trees.registerTreeView({
          id: EXTENSION_ROUTE_TREE_ID,
          title: "Extensions",
          area: "left",
          areaSize: { defaultPx: 280, minPx: 200 },
          icon: "Puzzle",
          defaultExpandedSectionIds: ["extension-routes"],
          getRoots: () => [],
          getChildren: () => [],
          getSections: () => [
            {
              id: "extension-routes",
              label: "Extensions",
              nodes: input.getRoutes().map((route) => {
                const resource = createExtensionRouteResource(input.projectId, route);
                return { id: resource.uri, label: route.label, icon: EXTENSION_ROUTE_ICON, resource };
              }),
            },
          ],
        }),
        ctx.commands.registerCommand(
          {
            id: EXTENSION_ROUTE_OPEN_COMMAND_ID,
            label: input.route.label,
            category: "Extensions",
            description: `Open ${input.route.label}`,
            icon: "Puzzle",
          },
          {
            execute: () => ctx.resources.openResource(activeResource),
          },
        ),
        ctx.menus.registerMenuAction(DASHBOARD_COMMAND_PALETTE_MENU, {
          commandId: EXTENSION_ROUTE_OPEN_COMMAND_ID,
          label: input.route.label,
          icon: "Puzzle",
        }),
      ];
    },
  }) satisfies ShellModuleContribution;

export const createDashboardExtensionRouteShell = (input: CreateDashboardExtensionRouteShellInput) => {
  const shell = createDashboardProjectShell({
    projectId: input.projectId,
    projectName: input.projectName,
    navigate: input.navigate,
    showProjectNavigationTree: false,
    createWebviewHostCapabilities: input.createWebviewHostCapabilities,
    createWebviewProps: input.createWebviewProps,
  });
  const disposable = shell.registerModule(createDashboardExtensionRouteModule(input));

  shell.layout.openWidget(EXTENSION_ROUTE_WIDGET_ID, {
    resource: createExtensionRouteResource(input.projectId, input.route),
  });

  return {
    ...shell,
    dispose: () => {
      disposable.dispose();
      shell.dispose();
    },
  };
};
