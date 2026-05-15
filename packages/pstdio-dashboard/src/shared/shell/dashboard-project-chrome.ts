import type { ResourceRef, ShellModuleContribution, ShellModuleContributionContext, TreeNode } from "pstdio-shell/core";
import {
  createProjectNavigationFooterSections,
  createProjectNavigationSections,
  createProjectRouteHref,
  createProjectRouteResource,
  DASHBOARD_COMMAND_RESOURCE_KIND,
  PROJECT_COMMAND_OPENER_ID,
  PROJECT_ROUTE_NAVIGATION_PARSER_ID,
  PROJECT_ROUTE_NAVIGATION_PRIORITY,
  PROJECT_ROUTE_NAVIGATOR_ID,
  PROJECT_ROUTE_OPENER_ID,
  PROJECT_ROUTE_RESOURCE_KIND,
  parseProjectRouteLocation,
} from "./dashboard-project-navigation";
import { createDashboardShortcutCommands } from "./dashboard-project-shortcuts";
import { DASHBOARD_COMMAND_PALETTE_MENU } from "./menu-locations";

export const PROJECT_RESOURCE_KIND = "project";
export const PROJECT_SETTINGS_WIDGET_ID = "project.settings";
export const PROJECT_NAVIGATION_HEADER_WIDGET_ID = "project.navigation.header";
export const PROJECT_OPEN_SETTINGS_COMMAND_ID = "project.openSettings";
export const PROJECT_NAVIGATION_PARSER_ID = "dashboard.projectUri";
export const PROJECT_NAVIGATOR_ID = "dashboard.projectRouter";
export const PROJECT_OPEN_SETTINGS_KEYBINDING = "Ctrl+Shift+,";
export const PROJECT_CONTEXT_WHEN = "projectId";

export interface DashboardProjectChromeInput {
  projectId?: string;
  projectName?: string;
  navigate: (path: string) => void;
  closeOverlay?: () => void;
  requestCreateTicket?: () => void;
  requestCreateSession?: () => void;
  openCommandPalette?: () => void;
  openCommandPaletteCommands?: () => void;
  openThemeMenu?: () => void;
  openShortcutHelp?: () => void;
  getExtensionNavigationNodes?: (projectId: string) => TreeNode[];
}

export const createDashboardProjectResource = (input: { projectId: string; projectName?: string }): ResourceRef => ({
  kind: PROJECT_RESOURCE_KIND,
  uri: `pstdio://project/${input.projectId}`,
  id: input.projectId,
  label: input.projectName ?? "Project",
});

const readContextString = (ctx: ShellModuleContributionContext, key: string) => {
  const value = ctx.context.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const readProjectId = (ctx: ShellModuleContributionContext, input: DashboardProjectChromeInput) =>
  readContextString(ctx, "projectId") ?? input.projectId ?? "";

const readProjectName = (ctx: ShellModuleContributionContext, input: DashboardProjectChromeInput) =>
  readContextString(ctx, "projectName") ?? input.projectName;

export const createActiveDashboardProjectResource = (
  ctx: ShellModuleContributionContext,
  input: DashboardProjectChromeInput,
) =>
  createDashboardProjectResource({
    projectId: readProjectId(ctx, input),
    projectName: readProjectName(ctx, input),
  });

export const createActiveProjectNavigationInput = (
  ctx: ShellModuleContributionContext,
  input: DashboardProjectChromeInput,
) => {
  const projectId = readProjectId(ctx, input);

  return {
    getExtensionNodes: () => input.getExtensionNavigationNodes?.(projectId) ?? [],
    projectId,
    projectName: readProjectName(ctx, input),
  };
};

const createProjectSettingsHref = (resource: ResourceRef) => `/projects/${resource.id}/settings`;

export const createDashboardProjectChromeModule = (input: DashboardProjectChromeInput): ShellModuleContribution => ({
  id: "dashboard.projectChrome",
  activate(ctx) {
    const shortcutCommands = createDashboardShortcutCommands(
      {
        ...input,
        get projectId() {
          return readProjectId(ctx, input);
        },
      },
      ctx,
    );

    return [
      ctx.resources.registerKind({ kind: PROJECT_RESOURCE_KIND, label: "Project", icon: "folder" }),
      ctx.resources.registerKind({ kind: PROJECT_ROUTE_RESOURCE_KIND, label: "Project route", icon: "FolderKanban" }),
      ctx.resources.registerKind({ kind: DASHBOARD_COMMAND_RESOURCE_KIND, label: "Dashboard command", icon: "Search" }),
      ctx.navigation.registerParser({
        id: PROJECT_NAVIGATION_PARSER_ID,
        priority: 100,
        canParse: (location) => location.startsWith("pstdio://project/"),
        parse: (location) => {
          const projectId = location.replace("pstdio://project/", "");
          const isActiveProject = projectId === readProjectId(ctx, input);

          return createDashboardProjectResource({
            projectId,
            projectName: isActiveProject ? readProjectName(ctx, input) : undefined,
          });
        },
      }),
      ctx.navigation.registerParser({
        id: PROJECT_ROUTE_NAVIGATION_PARSER_ID,
        priority: PROJECT_ROUTE_NAVIGATION_PRIORITY,
        canParse: (location) => parseProjectRouteLocation(location) !== null,
        parse: (location) => {
          const parsed = parseProjectRouteLocation(location);
          return createProjectRouteResource(
            parsed?.projectId ?? readProjectId(ctx, input),
            parsed?.routePath ?? "tickets",
          );
        },
      }),
      ctx.navigation.registerNavigator({
        id: PROJECT_NAVIGATOR_ID,
        priority: 100,
        canNavigate: (resource) => resource.kind === PROJECT_RESOURCE_KIND,
        createHref: createProjectSettingsHref,
        navigate: (resource) => {
          const href = createProjectSettingsHref(resource);
          input.navigate(href);
          return href;
        },
      }),
      ctx.navigation.registerNavigator({
        id: PROJECT_ROUTE_NAVIGATOR_ID,
        priority: PROJECT_ROUTE_NAVIGATION_PRIORITY,
        canNavigate: (resource) => resource.kind === PROJECT_ROUTE_RESOURCE_KIND,
        createHref: createProjectRouteHref,
        navigate: (resource) => {
          const href = createProjectRouteHref(resource);
          input.navigate(href);
          return href;
        },
      }),
      ctx.layout.registerWidget({
        id: PROJECT_SETTINGS_WIDGET_ID,
        title: "Project settings",
        area: "main",
        singleton: true,
        resourceKinds: [PROJECT_RESOURCE_KIND],
        renderer: "react",
        rendererId: PROJECT_SETTINGS_WIDGET_ID,
      }),
      ctx.layout.registerWidget({
        id: PROJECT_NAVIGATION_HEADER_WIDGET_ID,
        title: "Project",
        area: "left-header",
        singleton: true,
        renderer: "react",
        rendererId: PROJECT_NAVIGATION_HEADER_WIDGET_ID,
      }),
      ctx.resources.registerOpener({
        id: PROJECT_SETTINGS_WIDGET_ID,
        priority: 100,
        canOpen: (resource) => resource.kind === PROJECT_RESOURCE_KIND,
        open: async (resource, openInput) => {
          await ctx.navigation.navigateResource(resource);
          return ctx.layout.openWidget(PROJECT_SETTINGS_WIDGET_ID, {
            resource,
            replaceActive: openInput.replaceActive,
          });
        },
      }),
      ctx.resources.registerOpener({
        id: PROJECT_ROUTE_OPENER_ID,
        priority: 100,
        canOpen: (resource) => resource.kind === PROJECT_ROUTE_RESOURCE_KIND,
        open: (resource) => ctx.navigation.navigateResource(resource),
      }),
      ctx.resources.registerOpener({
        id: PROJECT_COMMAND_OPENER_ID,
        priority: 100,
        canOpen: (resource) => resource.kind === DASHBOARD_COMMAND_RESOURCE_KIND,
        open: (resource) => {
          const commandId = typeof resource.metadata?.commandId === "string" ? resource.metadata.commandId : null;
          return commandId ? ctx.commands.executeCommand(commandId, resource.metadata?.args) : undefined;
        },
      }),
      ...shortcutCommands.flatMap((shortcut) => [
        ctx.commands.registerCommand(
          {
            id: shortcut.commandId,
            label: shortcut.label,
            category: shortcut.category,
          },
          { execute: shortcut.execute },
        ),
        ctx.keybindings.registerKeybinding({
          commandId: shortcut.commandId,
          keybinding: shortcut.keybinding,
          when: PROJECT_CONTEXT_WHEN,
        }),
      ]),
      ctx.commands.registerCommand(
        {
          id: PROJECT_OPEN_SETTINGS_COMMAND_ID,
          label: "Project settings",
          category: "Project",
          description: "Open project settings",
          icon: "settings",
        },
        {
          execute: () => ctx.resources.openResource(createActiveDashboardProjectResource(ctx, input)),
        },
      ),
      ctx.menus.registerMenuAction(DASHBOARD_COMMAND_PALETTE_MENU, {
        commandId: PROJECT_OPEN_SETTINGS_COMMAND_ID,
        label: "Project settings",
        icon: "settings",
        when: PROJECT_CONTEXT_WHEN,
      }),
      ctx.keybindings.registerKeybinding({
        commandId: PROJECT_OPEN_SETTINGS_COMMAND_ID,
        keybinding: PROJECT_OPEN_SETTINGS_KEYBINDING,
        when: PROJECT_CONTEXT_WHEN,
      }),
    ];
  },
});

export const getProjectNavigationSections = (ctx: ShellModuleContributionContext, input: DashboardProjectChromeInput) =>
  createProjectNavigationSections(createActiveProjectNavigationInput(ctx, input));

export const getProjectNavigationFooterSections = (
  ctx: ShellModuleContributionContext,
  input: DashboardProjectChromeInput,
) => createProjectNavigationFooterSections(createActiveProjectNavigationInput(ctx, input));
