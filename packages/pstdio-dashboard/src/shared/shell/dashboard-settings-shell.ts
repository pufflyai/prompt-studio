import {
  activateProductModule,
  createShellCore,
  type ProductModuleContribution,
  type ResourceRef,
} from "pstdio-shell/core";
import { DASHBOARD_COMMAND_PALETTE_MENU } from "./menu-locations";

export const GLOBAL_SETTINGS_RESOURCE_KIND = "global-settings";
export const GLOBAL_SETTINGS_WIDGET_ID = "settings.agents";
export const GLOBAL_SETTINGS_TREE_ID = "settings.navigation";
export const GLOBAL_SETTINGS_OPEN_AGENTS_COMMAND_ID = "settings.openAgents";
export const GLOBAL_SETTINGS_NAVIGATION_PARSER_ID = "dashboard.settingsUri";
export const GLOBAL_SETTINGS_NAVIGATOR_ID = "dashboard.settingsRouter";

const DASHBOARD_ROUTE_RESOURCE_KIND = "dashboard-route";
const DASHBOARD_ROUTE_NAVIGATOR_ID = "dashboard.routeRouter";
const DASHBOARD_ROUTE_OPENER_ID = "dashboard.routeOpener";

export const GLOBAL_SETTINGS_AGENTS_RESOURCE: ResourceRef = {
  kind: GLOBAL_SETTINGS_RESOURCE_KIND,
  uri: "pstdio://settings/agents",
  id: "agents",
  label: "Agents",
  icon: "Terminal",
};

const PROJECTS_RESOURCE: ResourceRef = {
  kind: DASHBOARD_ROUTE_RESOURCE_KIND,
  uri: "pstdio://dashboard/projects",
  id: "projects",
  label: "Back",
  icon: "ArrowLeft",
};

interface DashboardSettingsShellInput {
  navigate: (path: string) => void;
}

const createSettingsHref = (resource: ResourceRef) => `/settings?panel=${resource.id ?? "agents"}`;
const createDashboardRouteHref = (resource: ResourceRef) => (resource.id === "projects" ? "/projects" : "/");

const createDashboardSettingsModule = (input: DashboardSettingsShellInput): ProductModuleContribution => ({
  id: "dashboard.settings",
  activate(ctx) {
    return [
      ctx.resources.registerKind({ kind: GLOBAL_SETTINGS_RESOURCE_KIND, label: "Settings", icon: "Settings" }),
      ctx.resources.registerKind({ kind: DASHBOARD_ROUTE_RESOURCE_KIND, label: "Dashboard route", icon: "PanelLeft" }),
      ctx.navigation.registerParser({
        id: GLOBAL_SETTINGS_NAVIGATION_PARSER_ID,
        priority: 100,
        canParse: (location) => location.startsWith("pstdio://settings/"),
        parse: () => GLOBAL_SETTINGS_AGENTS_RESOURCE,
      }),
      ctx.navigation.registerNavigator({
        id: GLOBAL_SETTINGS_NAVIGATOR_ID,
        priority: 100,
        canNavigate: (resource) => resource.kind === GLOBAL_SETTINGS_RESOURCE_KIND,
        createHref: createSettingsHref,
        navigate: (resource) => {
          const href = createSettingsHref(resource);
          input.navigate(href);
          return href;
        },
      }),
      ctx.navigation.registerNavigator({
        id: DASHBOARD_ROUTE_NAVIGATOR_ID,
        priority: 100,
        canNavigate: (resource) => resource.kind === DASHBOARD_ROUTE_RESOURCE_KIND,
        createHref: createDashboardRouteHref,
        navigate: (resource) => {
          const href = createDashboardRouteHref(resource);
          input.navigate(href);
          return href;
        },
      }),
      ctx.trees.registerTreeView({
        id: GLOBAL_SETTINGS_TREE_ID,
        title: "Settings",
        area: "left",
        areaSize: { defaultPx: 320, minPx: 200 },
        icon: "Settings",
        defaultExpandedSectionIds: ["settings"],
        getRoots: () => [],
        getChildren: () => [],
        getSections: () => [
          {
            id: "settings-back",
            nodes: [
              {
                id: PROJECTS_RESOURCE.uri,
                label: PROJECTS_RESOURCE.label ?? "Back",
                icon: PROJECTS_RESOURCE.icon,
                resource: PROJECTS_RESOURCE,
              },
            ],
          },
          {
            id: "settings",
            label: "Settings",
            nodes: [
              {
                id: GLOBAL_SETTINGS_AGENTS_RESOURCE.uri,
                label: GLOBAL_SETTINGS_AGENTS_RESOURCE.label ?? "Agents",
                icon: GLOBAL_SETTINGS_AGENTS_RESOURCE.icon,
                resource: GLOBAL_SETTINGS_AGENTS_RESOURCE,
              },
            ],
          },
        ],
      }),
      ctx.layout.registerWidget({
        id: GLOBAL_SETTINGS_WIDGET_ID,
        title: "Agent settings",
        area: "main",
        singleton: true,
        resourceKinds: [GLOBAL_SETTINGS_RESOURCE_KIND],
        renderer: "react",
        rendererId: GLOBAL_SETTINGS_WIDGET_ID,
      }),
      ctx.resources.registerOpener({
        id: GLOBAL_SETTINGS_WIDGET_ID,
        priority: 100,
        canOpen: (resource) => resource.kind === GLOBAL_SETTINGS_RESOURCE_KIND,
        open: async (resource, input) => {
          await ctx.navigation.navigateResource(resource);
          return ctx.layout.openWidget(GLOBAL_SETTINGS_WIDGET_ID, { resource, replaceActive: input.replaceActive });
        },
      }),
      ctx.resources.registerOpener({
        id: DASHBOARD_ROUTE_OPENER_ID,
        priority: 100,
        canOpen: (resource) => resource.kind === DASHBOARD_ROUTE_RESOURCE_KIND,
        open: (resource) => ctx.navigation.navigateResource(resource),
      }),
      ctx.commands.registerCommand(
        {
          id: GLOBAL_SETTINGS_OPEN_AGENTS_COMMAND_ID,
          label: "Agent settings",
          category: "Settings",
          description: "Open agent settings",
          icon: "Terminal",
        },
        {
          execute: () => ctx.resources.openResource(GLOBAL_SETTINGS_AGENTS_RESOURCE),
        },
      ),
      ctx.menus.registerMenuAction(DASHBOARD_COMMAND_PALETTE_MENU, {
        commandId: GLOBAL_SETTINGS_OPEN_AGENTS_COMMAND_ID,
        label: "Agent settings",
        icon: "Terminal",
      }),
    ];
  },
});

export const createDashboardSettingsShell = (input: DashboardSettingsShellInput) => {
  const shell = createShellCore();
  const disposable = activateProductModule(shell, createDashboardSettingsModule(input));

  shell.layout.openWidget(GLOBAL_SETTINGS_WIDGET_ID, {
    resource: GLOBAL_SETTINGS_AGENTS_RESOURCE,
    closable: false,
  });

  return {
    ...shell,
    dispose: () => disposable.dispose(),
  };
};
