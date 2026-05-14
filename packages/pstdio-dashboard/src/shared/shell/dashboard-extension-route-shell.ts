import type { ExtensionRouteRecord } from "pstdio-api-contracts";
import type { CreateBridgeWebviewHostCapabilities, CreateBridgeWebviewProps } from "pstdio-extensions/shell";
import type { WebviewDescriptor } from "pstdio-shell/core";
import { activateProductModule, type ProductModuleContribution, type ResourceRef } from "pstdio-shell/core";
import { createDashboardProjectShell } from "./dashboard-project-shell";
import { DASHBOARD_COMMAND_PALETTE_MENU } from "./menu-locations";

export const EXTENSION_ROUTE_RESOURCE_KIND = "extension-route";
export const EXTENSION_ROUTE_WIDGET_ID = "extension.route";
export const EXTENSION_ROUTE_TREE_ID = "extension.navigation";
export const EXTENSION_ROUTE_OPEN_COMMAND_ID = "extension.openRoute";
export const EXTENSION_ROUTE_NAVIGATION_PARSER_ID = "dashboard.extensionRouteUri";
export const EXTENSION_ROUTE_NAVIGATOR_ID = "dashboard.extensionRouteRouter";

const EXTENSION_ROUTE_ICON = "Puzzle";

// Extension URIs share the `pstdio://project/` prefix with the base project navigator, so
// the parser/navigator below run at a higher priority to win for extension-route resources.
const EXTENSION_ROUTE_CONTRIBUTION_PRIORITY = 200;

interface CreateDashboardExtensionRouteShellInput {
  projectId: string;
  projectName: string;
  route: ExtensionRouteRecord;
  // Read lazily by the navigation tree so it reflects the latest fetched metadata.
  getRoutes: () => ExtensionRouteRecord[];
  navigate: (path: string) => void;
  // Resolves API-served webview asset paths to absolute URLs (host concern — e.g. buildApiUrl).
  resolveAssetUrl: (path: string) => string;
  createWebviewHostCapabilities: CreateBridgeWebviewHostCapabilities;
  createWebviewProps: CreateBridgeWebviewProps;
}

export const createExtensionRouteResource = (projectId: string, route: ExtensionRouteRecord): ResourceRef => ({
  kind: EXTENSION_ROUTE_RESOURCE_KIND,
  uri: `pstdio://project/${projectId}/extension/${route.path}`,
  id: route.id,
  label: route.label,
  icon: EXTENSION_ROUTE_ICON,
});

const parseExtensionRouteUri = (uri: string) => {
  const match = uri.match(/^pstdio:\/\/project\/([^/]+)\/extension\/(.+)$/);
  if (!match) return null;
  return { projectId: match[1], routePath: match[2] };
};

const createExtensionRouteHref = (projectId: string, routePath: string) =>
  `/projects/${projectId}/extensions/${routePath}`;

const hrefFromResource = (resource: ResourceRef) => {
  const parsed = parseExtensionRouteUri(resource.uri);
  return parsed ? createExtensionRouteHref(parsed.projectId, parsed.routePath) : "/";
};

// Resolve API-served webview asset URLs the same way the dashboard does for every other
// extension surface, so the bridge runtime loads from the running API.
const buildExtensionWebviewDescriptor = (
  webview: ExtensionRouteRecord["webview"],
  resolveAssetUrl: (path: string) => string,
): WebviewDescriptor => ({
  title: webview.title,
  sandbox: webview.sandbox,
  capabilities: webview.capabilities,
  entry: webview.entry,
  assetUrl: webview.assetUrl ? resolveAssetUrl(webview.assetUrl) : undefined,
  runtimeUrl: webview.runtimeUrl ? resolveAssetUrl(webview.runtimeUrl) : undefined,
  moduleUrl: webview.moduleUrl ? resolveAssetUrl(webview.moduleUrl) : undefined,
  styles: webview.styles?.map(resolveAssetUrl),
});

const createDashboardExtensionRouteModule = (
  input: CreateDashboardExtensionRouteShellInput,
): ProductModuleContribution => ({
  id: "dashboard.extensionRoute",
  activate(ctx) {
    const activeResource = createExtensionRouteResource(input.projectId, input.route);

    return [
      ctx.resources.registerKind({ kind: EXTENSION_ROUTE_RESOURCE_KIND, label: "Extension view", icon: "Puzzle" }),
      ctx.navigation.registerParser({
        id: EXTENSION_ROUTE_NAVIGATION_PARSER_ID,
        priority: EXTENSION_ROUTE_CONTRIBUTION_PRIORITY,
        canParse: (location) => parseExtensionRouteUri(location) !== null,
        parse: (location) => {
          const parsed = parseExtensionRouteUri(location);
          const route = input.getRoutes().find((item) => item.path === parsed?.routePath);
          if (parsed && route) return createExtensionRouteResource(parsed.projectId, route);

          return {
            kind: EXTENSION_ROUTE_RESOURCE_KIND,
            uri: location,
            id: parsed?.routePath ?? location,
            label: "Extension view",
            icon: EXTENSION_ROUTE_ICON,
          };
        },
      }),
      ctx.navigation.registerNavigator({
        id: EXTENSION_ROUTE_NAVIGATOR_ID,
        priority: EXTENSION_ROUTE_CONTRIBUTION_PRIORITY,
        canNavigate: (resource) => resource.kind === EXTENSION_ROUTE_RESOURCE_KIND,
        createHref: hrefFromResource,
        navigate: (resource) => {
          const href = hrefFromResource(resource);
          input.navigate(href);
          return href;
        },
      }),
      ctx.layout.registerWidget({
        id: EXTENSION_ROUTE_WIDGET_ID,
        title: input.route.label,
        area: "main",
        singleton: true,
        resourceKinds: [EXTENSION_ROUTE_RESOURCE_KIND],
        renderer: "webview",
        webview: buildExtensionWebviewDescriptor(input.route.webview, input.resolveAssetUrl),
      }),
      ctx.resources.registerOpener({
        id: EXTENSION_ROUTE_WIDGET_ID,
        priority: 100,
        canOpen: (resource) => resource.kind === EXTENSION_ROUTE_RESOURCE_KIND,
        open: async (resource, openInput) => {
          await ctx.navigation.navigateResource(resource);
          return ctx.layout.openWidget(EXTENSION_ROUTE_WIDGET_ID, {
            resource,
            replaceActive: openInput.replaceActive,
            closable: false,
          });
        },
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
});

export const createDashboardExtensionRouteShell = (input: CreateDashboardExtensionRouteShellInput) => {
  const shell = createDashboardProjectShell({
    projectId: input.projectId,
    projectName: input.projectName,
    navigate: input.navigate,
    showProjectNavigationTree: false,
    createWebviewHostCapabilities: input.createWebviewHostCapabilities,
    createWebviewProps: input.createWebviewProps,
  });
  const disposable = activateProductModule(shell, createDashboardExtensionRouteModule(input));

  shell.layout.openWidget(EXTENSION_ROUTE_WIDGET_ID, {
    resource: createExtensionRouteResource(input.projectId, input.route),
    closable: false,
  });

  return {
    ...shell,
    dispose: () => {
      disposable.dispose();
      shell.dispose();
    },
  };
};
