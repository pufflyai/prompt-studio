import {
  type CreateBridgeWebviewHostCapabilities,
  type CreateBridgeWebviewProps,
  createBridgeWebviewRenderer,
} from "pstdio-extensions/shell";
import {
  activateProductModule,
  createShellCore,
  type LayoutPersistenceAdapter,
  type PreferencePersistenceAdapter,
  type ProductModuleContribution,
  type ResourceRef,
} from "pstdio-shell/core";
import {
  createProjectNavigationFooterSections,
  createProjectNavigationSections,
  createProjectRouteHref,
  createProjectRouteResource,
  DASHBOARD_COMMAND_RESOURCE_KIND,
  PROJECT_COMMAND_OPENER_ID,
  PROJECT_NAVIGATION_FOOTER_TREE_ID,
  PROJECT_NAVIGATION_MODE_ID,
  PROJECT_NAVIGATION_TREE_ID,
  PROJECT_ROUTE_NAVIGATION_PARSER_ID,
  PROJECT_ROUTE_NAVIGATION_PRIORITY,
  PROJECT_ROUTE_NAVIGATOR_ID,
  PROJECT_ROUTE_OPENER_ID,
  PROJECT_ROUTE_RESOURCE_KIND,
  parseProjectRouteLocation,
} from "./dashboard-project-navigation";
import { createDashboardShortcutCommands } from "./dashboard-project-shortcuts";
import {
  createDashboardShellLayoutPersistence,
  createDashboardShellPreferencePersistence,
  type DashboardShellStorage,
} from "./dashboard-shell-persistence";
import { DASHBOARD_COMMAND_PALETTE_MENU } from "./menu-locations";

export const PROJECT_RESOURCE_KIND = "project";
export const PROJECT_SETTINGS_WIDGET_ID = "project.settings";
export const PROJECT_NAVIGATION_HEADER_WIDGET_ID = "project.navigation.header";
export const PROJECT_OPEN_SETTINGS_COMMAND_ID = "project.openSettings";
export const PROJECT_NAVIGATION_PARSER_ID = "dashboard.projectUri";
export const PROJECT_NAVIGATOR_ID = "dashboard.projectRouter";
export const PROJECT_OPEN_SETTINGS_KEYBINDING = "Ctrl+Shift+,";
export {
  createProjectRouteResource,
  DASHBOARD_COMMAND_RESOURCE_KIND,
  PROJECT_NAVIGATION_FOOTER_TREE_ID,
  PROJECT_NAVIGATION_MODE_ID,
  PROJECT_NAVIGATION_TREE_ID,
  PROJECT_ROUTE_RESOURCE_KIND,
} from "./dashboard-project-navigation";
export {
  DASHBOARD_CHANGE_THEME_COMMAND_ID,
  DASHBOARD_CHANGE_THEME_KEYBINDING,
  DASHBOARD_CLOSE_OVERLAY_COMMAND_ID,
  DASHBOARD_CLOSE_OVERLAY_KEYBINDING,
  DASHBOARD_OPEN_COMMAND_PALETTE_COMMAND_ID,
  DASHBOARD_OPEN_COMMAND_PALETTE_COMMANDS_COMMAND_ID,
  DASHBOARD_OPEN_COMMAND_PALETTE_COMMANDS_KEYBINDING,
  DASHBOARD_OPEN_COMMAND_PALETTE_KEYBINDING,
  DASHBOARD_OPEN_SHORTCUT_HELP_COMMAND_ID,
  DASHBOARD_OPEN_SHORTCUT_HELP_KEYBINDING,
  DASHBOARD_PROJECT_SHORTCUTS,
  PROJECT_CREATE_SESSION_COMMAND_ID,
  PROJECT_CREATE_SESSION_KEYBINDING,
  PROJECT_CREATE_TICKET_COMMAND_ID,
  PROJECT_CREATE_TICKET_KEYBINDING,
  PROJECT_GO_TO_TICKETS_COMMAND_ID,
  PROJECT_GO_TO_TICKETS_KEYBINDING,
} from "./dashboard-project-shortcuts";

interface DashboardProjectShellInput {
  projectId: string;
  projectName?: string;
  navigate: (path: string) => void;
  showProjectNavigationTree?: boolean;
  storage?: DashboardShellStorage;
  layoutPersistence?: LayoutPersistenceAdapter;
  preferencePersistence?: PreferencePersistenceAdapter;
  closeOverlay?: () => void;
  requestCreateTicket?: () => void;
  requestCreateSession?: () => void;
  openCommandPalette?: () => void;
  openCommandPaletteCommands?: () => void;
  openThemeMenu?: () => void;
  openShortcutHelp?: () => void;
  createWebviewHostCapabilities?: CreateBridgeWebviewHostCapabilities;
  createWebviewProps?: CreateBridgeWebviewProps;
}
export const createDashboardProjectResource = (
  input: Pick<DashboardProjectShellInput, "projectId" | "projectName">,
): ResourceRef => ({
  kind: PROJECT_RESOURCE_KIND,
  uri: `pstdio://project/${input.projectId}`,
  id: input.projectId,
  label: input.projectName ?? "Project",
});

const createProjectSettingsHref = (resource: ResourceRef) => `/projects/${resource.id}/settings`;

const createDashboardProjectModule = (input: DashboardProjectShellInput): ProductModuleContribution => ({
  id: "dashboard.project",
  activate(ctx) {
    const projectResource = createDashboardProjectResource(input);
    const shortcutCommands = createDashboardShortcutCommands(input, ctx);
    const showProjectNavigationTree = input.showProjectNavigationTree ?? true;

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

          return createDashboardProjectResource({
            projectId,
            projectName: projectId === input.projectId ? input.projectName : undefined,
          });
        },
      }),
      ctx.navigation.registerParser({
        id: PROJECT_ROUTE_NAVIGATION_PARSER_ID,
        priority: PROJECT_ROUTE_NAVIGATION_PRIORITY,
        canParse: (location) => parseProjectRouteLocation(location) !== null,
        parse: (location) => {
          const parsed = parseProjectRouteLocation(location);
          const projectId = parsed?.projectId ?? input.projectId;
          const routePath = parsed?.routePath ?? "tickets";

          return createProjectRouteResource(projectId, routePath);
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
      ctx.resources.registerOpener({
        id: PROJECT_SETTINGS_WIDGET_ID,
        priority: 100,
        canOpen: (resource) => resource.kind === PROJECT_RESOURCE_KIND,
        open: async (resource, input) => {
          await ctx.navigation.navigateResource(resource);
          return ctx.layout.openWidget(PROJECT_SETTINGS_WIDGET_ID, { resource, replaceActive: input.replaceActive });
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
          {
            execute: shortcut.execute,
          },
        ),
        ctx.keybindings.registerKeybinding({
          commandId: shortcut.commandId,
          keybinding: shortcut.keybinding,
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
          execute: () => ctx.resources.openResource(projectResource),
        },
      ),
      ctx.menus.registerMenuAction(DASHBOARD_COMMAND_PALETTE_MENU, {
        commandId: PROJECT_OPEN_SETTINGS_COMMAND_ID,
        label: "Project settings",
        icon: "settings",
        args: { projectId: input.projectId },
      }),
      ctx.keybindings.registerKeybinding({
        commandId: PROJECT_OPEN_SETTINGS_COMMAND_ID,
        keybinding: PROJECT_OPEN_SETTINGS_KEYBINDING,
      }),
      ...(showProjectNavigationTree
        ? [
            ctx.layout.registerWidget({
              id: PROJECT_NAVIGATION_HEADER_WIDGET_ID,
              title: "Project",
              area: "left-header",
              singleton: true,
              renderer: "react",
              rendererId: PROJECT_NAVIGATION_HEADER_WIDGET_ID,
            }),
            ctx.modes.registerMode({
              id: PROJECT_NAVIGATION_MODE_ID,
              label: "Project",
              activate: (modeCtx) => [
                modeCtx.trees.registerTreeView({
                  id: PROJECT_NAVIGATION_TREE_ID,
                  title: "Project",
                  area: "left",
                  areaSize: { defaultPx: 240, minPx: 200 },
                  icon: "FolderKanban",
                  getRoots: () => [
                    { id: input.projectId, label: projectResource.label ?? input.projectId, resource: projectResource },
                  ],
                  getChildren: () => [],
                  getSections: () => createProjectNavigationSections(input),
                }),
                modeCtx.trees.registerTreeView({
                  id: PROJECT_NAVIGATION_FOOTER_TREE_ID,
                  title: "Project footer",
                  area: "left",
                  role: "footer",
                  icon: "Settings",
                  getRoots: () => [],
                  getChildren: () => [],
                  getSections: () => createProjectNavigationFooterSections(input),
                }),
              ],
            }),
          ]
        : []),
    ];
  },
});

export const createDashboardProjectShell = (input: DashboardProjectShellInput) => {
  const shell = createShellCore({
    layoutPersistence:
      input.layoutPersistence ??
      createDashboardShellLayoutPersistence({ projectId: input.projectId, storage: input.storage }),
    preferencePersistence:
      input.preferencePersistence ??
      createDashboardShellPreferencePersistence({ projectId: input.projectId, storage: input.storage }),
  });
  const bridgeRenderer = shell.renderers.registerRenderer(
    createBridgeWebviewRenderer({
      createHostCapabilities: input.createWebviewHostCapabilities,
      createProps: input.createWebviewProps,
    }),
  );
  const disposable = activateProductModule(shell, createDashboardProjectModule(input));
  if (input.showProjectNavigationTree ?? true) {
    shell.modes.setActiveMode(PROJECT_NAVIGATION_MODE_ID);
    shell.layout.openWidget(PROJECT_NAVIGATION_HEADER_WIDGET_ID, {
      closable: false,
      pinned: true,
    });
  } else {
    shell.layout.clearArea("left-header");
  }
  return {
    ...shell,
    dispose: () => {
      disposable.dispose();
      bridgeRenderer.dispose();
    },
  };
};
