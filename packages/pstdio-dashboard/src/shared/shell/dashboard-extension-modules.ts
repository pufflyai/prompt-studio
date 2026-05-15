import type {
  CommandExecuteRequest,
  DashboardExtensionMetadata,
  DashboardExtensionRouteRecord,
  ExtensionMenuContribution,
  ExtensionNavigationRecord,
} from "pstdio-api-contracts";
import { BRIDGE_WEBVIEW_RENDERER_ID, type BridgeWebviewConfig } from "pstdio-extensions/shell";
import {
  type ResourceRef,
  type ShellModuleContribution,
  type TreeNode,
  workbenchTopHeaderTrailingMenuPath,
} from "pstdio-shell/core";
import { buildExtensionCommandRequest } from "../extensions/slot-context";
import type { ExtensionResourceContext, ExtensionSlotKind } from "../extensions/types";
import { DASHBOARD_COMMAND_PALETTE_MENU } from "./menu-locations";

export const DASHBOARD_EXTENSIONS_MODULE_ID = "dashboard.extensions";
export const EXTENSION_ROUTE_RESOURCE_KIND = "extension-route";
export const EXTENSION_ROUTE_NAVIGATION_PARSER_ID = "dashboard.extensionRouteUri";
export const EXTENSION_ROUTE_NAVIGATOR_ID = "dashboard.extensionRouteRouter";
export const EXTENSION_ROUTE_OPENER_ID = "dashboard.extensionRouteOpener";

const PROJECT_CONTEXT_WHEN = "projectId";
const PROJECT_COMMAND_PANEL_SLOT_ID = "project.commandPanel";
const PROJECT_HEADER_PRIMARY_SLOT_ID = "project.headerPrimary";
const PROJECT_HEADER_OVERFLOW_SLOT_ID = "project.headerOverflow";
const PROJECT_SIDEBAR_NAV_SLOT_ID = "project.sidebarNav";
const extensionRoutePriority = 220;
const menuPlacementOrder = { first: 0, default: 100, last: 200 } satisfies Record<
  NonNullable<ExtensionMenuContribution["placement"]>,
  number
>;

export const dashboardExtensionModuleId = (extensionId: string) => `extension.${extensionId}`;

const normalizeRoutePath = (routePath: string) => routePath.replace(/^\/+|\/+$/g, "");

export const createExtensionRouteResource = (
  projectId: string,
  route: Pick<DashboardExtensionRouteRecord, "id" | "label" | "path"> & { icon?: string },
) => {
  const routePath = normalizeRoutePath(route.path);

  return {
    kind: EXTENSION_ROUTE_RESOURCE_KIND,
    uri: `pstdio://project/${projectId}/extension/${routePath}`,
    id: route.id,
    label: route.label,
    icon: route.icon ?? "Puzzle",
    metadata: { projectId, routePath, widgetId: route.id },
  };
};

const parseExtensionRouteUri = (uri: string) => {
  const match = uri.match(/^pstdio:\/\/project\/([^/]+)\/extension\/(.+)$/);
  if (!match) return null;
  return { projectId: match[1] ?? "", routePath: normalizeRoutePath(match[2] ?? "") };
};

const extensionRouteHref = (resource: ResourceRef) => {
  const metadataProjectId = typeof resource.metadata?.projectId === "string" ? resource.metadata.projectId : null;
  const metadataRoutePath = typeof resource.metadata?.routePath === "string" ? resource.metadata.routePath : null;
  const parsed =
    metadataProjectId && metadataRoutePath
      ? { projectId: metadataProjectId, routePath: metadataRoutePath }
      : parseExtensionRouteUri(resource.uri);

  return parsed ? `/projects/${parsed.projectId}/extensions/${parsed.routePath}` : "/";
};

const buildExtensionWebviewConfig = (
  webview: DashboardExtensionRouteRecord["webview"],
  resolve: (path: string) => string,
): BridgeWebviewConfig => ({
  title: webview.title,
  capabilities: webview.capabilities,
  runtimeUrl: resolve(webview.runtimeUrl),
  moduleUrl: resolve(webview.moduleUrl),
  styles: webview.styles?.map(resolve),
});

interface ExtensionCommandArgs {
  kind?: ExtensionSlotKind;
  params?: Record<string, unknown>;
  resource?: ExtensionResourceContext;
  slotId?: string;
}

const readCommandArgs = (args: unknown): ExtensionCommandArgs =>
  typeof args === "object" && args !== null ? (args as ExtensionCommandArgs) : {};

const createMenuActionArgs = (contribution: ExtensionMenuContribution): ExtensionCommandArgs => ({
  kind: "menu",
  params: contribution.params,
  slotId: contribution.slotId,
});

const menuOrder = (contribution: ExtensionMenuContribution) => menuPlacementOrder[contribution.placement ?? "default"];

const menuPathForSlot = (slotId: string) => {
  if (slotId === PROJECT_COMMAND_PANEL_SLOT_ID) return DASHBOARD_COMMAND_PALETTE_MENU;
  if (slotId === PROJECT_HEADER_PRIMARY_SLOT_ID || slotId === PROJECT_HEADER_OVERFLOW_SLOT_ID)
    return workbenchTopHeaderTrailingMenuPath;
  return null;
};

const menuGroupForSlot = (slotId: string, group: string | undefined) => {
  if (slotId === PROJECT_HEADER_PRIMARY_SLOT_ID) return "primary";
  if (slotId === PROJECT_HEADER_OVERFLOW_SLOT_ID) return "overflow";
  return group;
};

export interface DashboardExtensionNavigationState {
  register(
    extensionId: string,
    records: ExtensionNavigationRecord[],
    routes: DashboardExtensionRouteRecord[],
  ): { dispose(): void };
  listProjectSidebarNodes(projectId: string): TreeNode[];
}

export const createDashboardExtensionNavigationState = (): DashboardExtensionNavigationState => {
  const byExtensionId = new Map<
    string,
    { records: ExtensionNavigationRecord[]; routes: DashboardExtensionRouteRecord[] }
  >();

  return {
    register(extensionId, records, routes) {
      byExtensionId.set(extensionId, { records, routes });
      return {
        dispose() {
          byExtensionId.delete(extensionId);
        },
      };
    },

    listProjectSidebarNodes(projectId) {
      return [...byExtensionId.values()].flatMap(({ records, routes }) =>
        records
          .filter((record) => record.slotId === PROJECT_SIDEBAR_NAV_SLOT_ID)
          .map((record) => {
            const route = routes.find((candidate) => candidate.path === record.route);
            const routeResource = route
              ? createExtensionRouteResource(projectId, { ...route, label: record.label, icon: record.icon })
              : undefined;

            return {
              id: routeResource?.uri ?? record.id,
              label: record.label,
              icon: record.icon,
              resource: routeResource,
            };
          }),
      );
    },
  };
};

export interface CreateDashboardExtensionHostModuleInput {
  navigate(path: string): void;
}

export const createDashboardExtensionHostModule = (input: CreateDashboardExtensionHostModuleInput) =>
  ({
    id: DASHBOARD_EXTENSIONS_MODULE_ID,
    activate(ctx) {
      ctx.resources.registerKind({ kind: EXTENSION_ROUTE_RESOURCE_KIND, label: "Extension route", icon: "Puzzle" });
      ctx.navigation.registerParser({
        id: EXTENSION_ROUTE_NAVIGATION_PARSER_ID,
        priority: extensionRoutePriority,
        canParse: (location) => parseExtensionRouteUri(location) !== null,
        parse: (location) => {
          const parsed = parseExtensionRouteUri(location);
          return {
            kind: EXTENSION_ROUTE_RESOURCE_KIND,
            uri: location,
            id: parsed?.routePath ?? location,
            label: "Extension",
            icon: "Puzzle",
            metadata: parsed ?? undefined,
          };
        },
      });
      ctx.navigation.registerNavigator({
        id: EXTENSION_ROUTE_NAVIGATOR_ID,
        priority: extensionRoutePriority,
        canNavigate: (resource) => resource.kind === EXTENSION_ROUTE_RESOURCE_KIND,
        createHref: extensionRouteHref,
        navigate: (resource) => {
          const href = extensionRouteHref(resource);
          input.navigate(href);
          return href;
        },
      });
      ctx.resources.registerOpener({
        id: EXTENSION_ROUTE_OPENER_ID,
        priority: extensionRoutePriority,
        canOpen: (resource) => resource.kind === EXTENSION_ROUTE_RESOURCE_KIND,
        open: async (resource, openInput) => {
          await ctx.navigation.navigateResource(resource);
          const widgetId = typeof resource.metadata?.widgetId === "string" ? resource.metadata.widgetId : resource.id;
          if (widgetId && ctx.layout.getWidget(widgetId)) {
            return ctx.layout.openWidget(widgetId, {
              resource,
              replaceActive: openInput.replaceActive,
            });
          }
          return undefined;
        },
      });
    },
  }) satisfies ShellModuleContribution;

export interface CreateDashboardExtensionModulesInput {
  executeCommand(input: { commandId: string; body: CommandExecuteRequest }): Promise<unknown>;
  metadata: DashboardExtensionMetadata;
  navigation: DashboardExtensionNavigationState;
  projectId: string;
  resolveAssetUrl(path: string): string;
}

export const createDashboardExtensionModules = (input: CreateDashboardExtensionModulesInput) =>
  input.metadata.extensions.map((extension) => {
    const commands = input.metadata.commands.filter((command) => command.extensionId === extension.id);
    const menus = input.metadata.menuContributions.filter((menu) => menu.extensionId === extension.id);
    const navigation = input.metadata.navigation.filter((item) => item.extensionId === extension.id);
    const routes = input.metadata.routes.filter((route) => route.extensionId === extension.id);

    return {
      id: dashboardExtensionModuleId(extension.id),
      ownerId: extension.id,
      source: "extension",
      activate(ctx) {
        const navigationDisposable = input.navigation.register(extension.id, navigation, routes);

        for (const command of commands) {
          ctx.commands.registerCommand(
            {
              id: command.id,
              label: command.title,
              category: extension.displayName,
              description: command.description,
              icon: "terminal",
            },
            {
              execute: (args) => {
                const commandArgs = readCommandArgs(args);
                return input.executeCommand({
                  commandId: command.id,
                  body: buildExtensionCommandRequest({
                    projectId: input.projectId,
                    slotId: commandArgs.slotId ?? PROJECT_COMMAND_PANEL_SLOT_ID,
                    kind: commandArgs.kind ?? "menu",
                    params: commandArgs.params,
                    resource: commandArgs.resource,
                  }),
                });
              },
            },
          );
        }

        for (const menu of menus) {
          const path = menuPathForSlot(menu.slotId);
          if (!path) continue;
          ctx.menus.registerMenuAction(path, {
            commandId: menu.commandId,
            label: menu.label,
            icon: menu.icon,
            group: menuGroupForSlot(menu.slotId, menu.group),
            order: menuOrder(menu),
            args: createMenuActionArgs(menu),
            when: PROJECT_CONTEXT_WHEN,
          });
        }

        for (const route of routes) {
          ctx.layout.registerWidget({
            id: route.id,
            title: route.label,
            area: "main",
            singleton: true,
            resourceKinds: [EXTENSION_ROUTE_RESOURCE_KIND],
            rendererId: BRIDGE_WEBVIEW_RENDERER_ID,
            config: buildExtensionWebviewConfig(route.webview, input.resolveAssetUrl),
          });
        }

        if (ctx.trees.getTreeView("project.navigation")) ctx.trees.refresh("project.navigation");

        return {
          dispose() {
            navigationDisposable.dispose();
            if (ctx.trees.getTreeView("project.navigation")) ctx.trees.refresh("project.navigation");
          },
        };
      },
    } satisfies ShellModuleContribution;
  });
