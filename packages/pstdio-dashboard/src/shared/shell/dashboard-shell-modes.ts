import type { ResourceRef, ShellModeContribution, ShellModuleContribution } from "pstdio-shell/core";
import {
  createActiveDashboardProjectResource,
  type DashboardProjectChromeInput,
  getProjectNavigationFooterSections,
  getProjectNavigationSections,
  PROJECT_CONTEXT_WHEN,
  PROJECT_NAVIGATION_HEADER_WIDGET_ID,
} from "./dashboard-project-chrome";
import { PROJECT_NAVIGATION_FOOTER_TREE_ID, PROJECT_NAVIGATION_TREE_ID } from "./dashboard-project-navigation";
import { DASHBOARD_COMMAND_PALETTE_MENU } from "./menu-locations";
import { createTicketsResource, TICKETS_MAIN_WIDGET_ID } from "./tickets/dashboard-tickets-module";

// ---------------------------------------------------------------------------
// Widget contributions and resource kinds live at shell construction time,
// not inside mode `activate()`. The route component opens its widget in the
// same useEffect that registers the React renderer; because child effects run
// before parent effects (the adapter's mode activation), placing widget
// contributions on the mode would mean openWidget fires before the mode has
// activated and `findWidget` throws.
//
// Modes still handle tree views, navigators, parsers, openers, and any other
// contributions whose lifetime should match the active route.
// ---------------------------------------------------------------------------

export const PROJECTS_LIST_RESOURCE_KIND = "projects-list";
export const PROJECTS_LIST_WIDGET_ID = "projects.list";

export const PROJECTS_LIST_RESOURCE: ResourceRef = {
  kind: PROJECTS_LIST_RESOURCE_KIND,
  uri: "pstdio://dashboard/projects",
  id: "projects",
  label: "Projects",
  icon: "Folder",
};

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

const PROJECTS_BACK_RESOURCE: ResourceRef = {
  kind: DASHBOARD_ROUTE_RESOURCE_KIND,
  uri: "pstdio://dashboard/projects",
  id: "projects",
  label: "Back",
  icon: "ArrowLeft",
};

const createSettingsHref = (resource: ResourceRef) => `/settings?panel=${resource.id ?? "agents"}`;
const createDashboardRouteHref = (resource: ResourceRef) => (resource.id === "projects" ? "/projects" : "/");

/**
 * Module activated once at shell construction. Registers resource kinds and
 * widget contributions for every dashboard widget so route components can
 * `openWidget` regardless of which mode is active.
 */
export const createDashboardShellBaseModule = (): ShellModuleContribution => ({
  id: "dashboard.base",
  activate(ctx) {
    return [
      ctx.resources.registerKind({ kind: PROJECTS_LIST_RESOURCE_KIND, label: "Projects", icon: "Folder" }),
      ctx.resources.registerKind({ kind: GLOBAL_SETTINGS_RESOURCE_KIND, label: "Settings", icon: "Settings" }),
      ctx.resources.registerKind({ kind: DASHBOARD_ROUTE_RESOURCE_KIND, label: "Dashboard route", icon: "PanelLeft" }),
      ctx.layout.registerWidget({
        id: PROJECTS_LIST_WIDGET_ID,
        title: "Projects",
        area: "main",
        singleton: true,
        resourceKinds: [PROJECTS_LIST_RESOURCE_KIND],
        rendererId: PROJECTS_LIST_WIDGET_ID,
      }),
      ctx.layout.registerWidget({
        id: GLOBAL_SETTINGS_WIDGET_ID,
        title: "Agent settings",
        area: "main",
        singleton: true,
        resourceKinds: [GLOBAL_SETTINGS_RESOURCE_KIND],
        rendererId: GLOBAL_SETTINGS_WIDGET_ID,
      }),
    ];
  },
});

// ---------------------------------------------------------------------------
// dashboard.projects-list
// ---------------------------------------------------------------------------

export const createDashboardProjectsListMode = (): ShellModeContribution => ({
  id: "dashboard.projects-list",
  label: "Projects",
  activate(ctx) {
    ctx.layout.clearArea("left-header");
    ctx.layout.clearArea("left");
    ctx.layout.clearArea("main");
    ctx.layout.openWidget(PROJECTS_LIST_WIDGET_ID, {
      resource: PROJECTS_LIST_RESOURCE,
    });
    return undefined;
  },
});

// ---------------------------------------------------------------------------
// dashboard.settings — registers settings-specific tree, navigators, openers,
// command + menu while the route is active.
// ---------------------------------------------------------------------------

interface CreateDashboardSettingsModeInput {
  navigate: (path: string) => void;
}

export const createDashboardSettingsMode = (input: CreateDashboardSettingsModeInput): ShellModeContribution => ({
  id: "dashboard.settings",
  label: "Settings",
  activate(ctx) {
    ctx.layout.clearArea("left-header");
    ctx.layout.clearArea("left");
    ctx.layout.clearArea("main");
    ctx.layout.openWidget(GLOBAL_SETTINGS_WIDGET_ID, {
      resource: GLOBAL_SETTINGS_AGENTS_RESOURCE,
    });
    return [
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
                id: PROJECTS_BACK_RESOURCE.uri,
                label: PROJECTS_BACK_RESOURCE.label ?? "Back",
                icon: PROJECTS_BACK_RESOURCE.icon,
                resource: PROJECTS_BACK_RESOURCE,
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
      ctx.resources.registerOpener({
        id: GLOBAL_SETTINGS_WIDGET_ID,
        priority: 100,
        canOpen: (resource) => resource.kind === GLOBAL_SETTINGS_RESOURCE_KIND,
        open: async (resource, openInput) => {
          await ctx.navigation.navigateResource(resource);
          return ctx.layout.openWidget(GLOBAL_SETTINGS_WIDGET_ID, {
            resource,
            replaceActive: openInput.replaceActive,
          });
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

// ---------------------------------------------------------------------------
// Project navigation owns only the shared project chrome in this chunk. Route
// widgets are added by later migration slices.
// ---------------------------------------------------------------------------

export const createProjectNavigationMode = (input: DashboardProjectChromeInput): ShellModeContribution => ({
  id: "project.navigation",
  label: "Project",
  activate(ctx) {
    ctx.layout.clearArea("left-header");
    ctx.layout.clearArea("main");
    ctx.layout.openWidget(PROJECT_NAVIGATION_HEADER_WIDGET_ID, {
      pinned: true,
    });
    const contextProjectId = ctx.context.get("projectId");
    const projectId = typeof contextProjectId === "string" ? contextProjectId : input.projectId;
    if (projectId) {
      ctx.layout.openWidget(TICKETS_MAIN_WIDGET_ID, {
        resource: createTicketsResource(projectId),
      });
    }

    return [
      ctx.trees.registerTreeView({
        id: PROJECT_NAVIGATION_TREE_ID,
        title: "Project",
        area: "left",
        areaSize: { defaultPx: 240, minPx: 200 },
        icon: "FolderKanban",
        when: PROJECT_CONTEXT_WHEN,
        getRoots: () => {
          const projectResource = createActiveDashboardProjectResource(ctx, input);
          return [
            {
              id: projectResource.id ?? projectResource.uri,
              label: projectResource.label ?? "Project",
              resource: projectResource,
            },
          ];
        },
        getChildren: () => [],
        getSections: () => getProjectNavigationSections(ctx, input),
      }),
      ctx.trees.registerTreeView({
        id: PROJECT_NAVIGATION_FOOTER_TREE_ID,
        title: "Project footer",
        area: "left",
        role: "footer",
        icon: "Settings",
        when: PROJECT_CONTEXT_WHEN,
        getRoots: () => [],
        getChildren: () => [],
        getSections: () => getProjectNavigationFooterSections(ctx, input),
      }),
    ];
  },
});

export const createDashboardWorkspacesMode = (): ShellModeContribution => ({
  id: "dashboard.workspaces",
  activate: (ctx) => {
    ctx.layout.clearArea("left-header");
    return undefined;
  },
});

export const createProjectSettingsMode = (): ShellModeContribution => ({
  id: "project.settings",
  activate: () => undefined,
});
