import {
  activateProductModule,
  createShellCore,
  type LayoutPersistenceAdapter,
  type PreferencePersistenceAdapter,
  type ProductModuleContribution,
  type ResourceRef,
} from "pstdio-shell/core";
import {
  createDashboardShellLayoutPersistence,
  createDashboardShellPreferencePersistence,
  type DashboardShellStorage,
} from "./dashboard-shell-persistence";
import { DASHBOARD_COMMAND_PALETTE_MENU } from "./menu-locations";

export const PROJECT_RESOURCE_KIND = "project";
export const PROJECT_SETTINGS_WIDGET_ID = "project.settings";
export const PROJECT_SETTINGS_SIDEBAR_WIDGET_ID = "project.settings.sidebar";
export const DASHBOARD_CLOSE_OVERLAY_COMMAND_ID = "dashboard.closeOverlay";
export const DASHBOARD_OPEN_COMMAND_PALETTE_COMMAND_ID = "dashboard.openCommandPalette";
export const DASHBOARD_OPEN_COMMAND_PALETTE_COMMANDS_COMMAND_ID = "dashboard.openCommandPaletteCommands";
export const DASHBOARD_CHANGE_THEME_COMMAND_ID = "dashboard.changeTheme";
export const DASHBOARD_OPEN_SHORTCUT_HELP_COMMAND_ID = "dashboard.openShortcutHelp";
export const PROJECT_CREATE_TICKET_COMMAND_ID = "project.createTicket";
export const PROJECT_CREATE_SESSION_COMMAND_ID = "project.createSession";
export const PROJECT_GO_TO_TICKETS_COMMAND_ID = "project.goToTickets";
export const PROJECT_OPEN_SETTINGS_COMMAND_ID = "project.openSettings";
export const PROJECT_NAVIGATION_PARSER_ID = "dashboard.projectUri";
export const PROJECT_NAVIGATOR_ID = "dashboard.projectRouter";
export const DASHBOARD_CLOSE_OVERLAY_KEYBINDING = "Escape";
export const DASHBOARD_OPEN_COMMAND_PALETTE_KEYBINDING = "Ctrl+Shift+P";
export const DASHBOARD_OPEN_COMMAND_PALETTE_COMMANDS_KEYBINDING = "Ctrl+Shift+.";
export const DASHBOARD_CHANGE_THEME_KEYBINDING = "Ctrl+Shift+K";
export const DASHBOARD_OPEN_SHORTCUT_HELP_KEYBINDING = "Ctrl+Shift+H";
export const PROJECT_CREATE_TICKET_KEYBINDING = "Ctrl+Shift+C";
export const PROJECT_CREATE_SESSION_KEYBINDING = "Ctrl+Shift+S";
export const PROJECT_GO_TO_TICKETS_KEYBINDING = "Ctrl+Shift+T";
export const PROJECT_OPEN_SETTINGS_KEYBINDING = "Ctrl+Shift+,";
export const PROJECT_NAVIGATION_TREE_ID = "project.navigation";

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

export const DASHBOARD_PROJECT_SHORTCUTS = [
  {
    commandId: DASHBOARD_CLOSE_OVERLAY_COMMAND_ID,
    label: "Close overlay",
    category: "Application",
    keybinding: DASHBOARD_CLOSE_OVERLAY_KEYBINDING,
  },
  {
    commandId: PROJECT_CREATE_TICKET_COMMAND_ID,
    label: "Create ticket",
    category: "Project",
    keybinding: PROJECT_CREATE_TICKET_KEYBINDING,
  },
  {
    commandId: PROJECT_CREATE_SESSION_COMMAND_ID,
    label: "Create session",
    category: "Project",
    keybinding: PROJECT_CREATE_SESSION_KEYBINDING,
  },
  {
    commandId: PROJECT_GO_TO_TICKETS_COMMAND_ID,
    label: "Go to tickets",
    category: "Project",
    keybinding: PROJECT_GO_TO_TICKETS_KEYBINDING,
  },
  {
    commandId: DASHBOARD_OPEN_COMMAND_PALETTE_COMMAND_ID,
    label: "Command palette",
    category: "Application",
    keybinding: DASHBOARD_OPEN_COMMAND_PALETTE_KEYBINDING,
  },
  {
    commandId: DASHBOARD_OPEN_COMMAND_PALETTE_COMMANDS_COMMAND_ID,
    label: "Run a command",
    category: "Application",
    keybinding: DASHBOARD_OPEN_COMMAND_PALETTE_COMMANDS_KEYBINDING,
  },
  {
    commandId: DASHBOARD_CHANGE_THEME_COMMAND_ID,
    label: "Change theme",
    category: "Application",
    keybinding: DASHBOARD_CHANGE_THEME_KEYBINDING,
  },
  {
    commandId: DASHBOARD_OPEN_SHORTCUT_HELP_COMMAND_ID,
    label: "Keyboard shortcuts",
    category: "Application",
    keybinding: DASHBOARD_OPEN_SHORTCUT_HELP_KEYBINDING,
  },
] as const;

const noop = () => {};

const resolveDashboardShortcutExecute = (input: DashboardProjectShellInput, commandId: string) => {
  if (commandId === DASHBOARD_CLOSE_OVERLAY_COMMAND_ID) return input.closeOverlay ?? noop;
  if (commandId === PROJECT_CREATE_TICKET_COMMAND_ID) return input.requestCreateTicket ?? noop;
  if (commandId === PROJECT_CREATE_SESSION_COMMAND_ID) return input.requestCreateSession ?? noop;
  if (commandId === PROJECT_GO_TO_TICKETS_COMMAND_ID) {
    return () => input.navigate(`/projects/${input.projectId}/tickets`);
  }
  if (commandId === DASHBOARD_OPEN_COMMAND_PALETTE_COMMAND_ID) return input.openCommandPalette ?? noop;
  if (commandId === DASHBOARD_OPEN_COMMAND_PALETTE_COMMANDS_COMMAND_ID) return input.openCommandPaletteCommands ?? noop;
  if (commandId === DASHBOARD_CHANGE_THEME_COMMAND_ID) return input.openThemeMenu ?? noop;
  if (commandId === DASHBOARD_OPEN_SHORTCUT_HELP_COMMAND_ID) return input.openShortcutHelp ?? noop;

  return noop;
};

const createDashboardShortcutCommands = (input: DashboardProjectShellInput) =>
  DASHBOARD_PROJECT_SHORTCUTS.map((shortcut) => ({
    ...shortcut,
    execute: resolveDashboardShortcutExecute(input, shortcut.commandId),
  }));

const createDashboardProjectModule = (input: DashboardProjectShellInput): ProductModuleContribution => ({
  id: "dashboard.project",
  activate(ctx) {
    const projectResource = createDashboardProjectResource(input);
    const shortcutCommands = createDashboardShortcutCommands(input);
    const showProjectNavigationTree = input.showProjectNavigationTree ?? true;

    return [
      ctx.resources.registerKind({ kind: PROJECT_RESOURCE_KIND, label: "Project", icon: "folder" }),
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
      ctx.layout.registerWidget({
        id: PROJECT_SETTINGS_SIDEBAR_WIDGET_ID,
        title: "Project settings navigation",
        area: showProjectNavigationTree ? "main-left" : "left",
        singleton: true,
        resourceKinds: [PROJECT_RESOURCE_KIND],
        renderer: "react",
        rendererId: PROJECT_SETTINGS_SIDEBAR_WIDGET_ID,
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
        open: async (resource) => {
          await ctx.navigation.navigateResource(resource);
          ctx.layout.openWidget(PROJECT_SETTINGS_SIDEBAR_WIDGET_ID, { resource, closable: false });
          return ctx.layout.openWidget(PROJECT_SETTINGS_WIDGET_ID, { resource });
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
            ctx.trees.registerTreeView({
              id: PROJECT_NAVIGATION_TREE_ID,
              title: "Project",
              area: "left",
              icon: "folder",
              getRoots: () => [
                { id: input.projectId, label: projectResource.label ?? input.projectId, resource: projectResource },
              ],
              getChildren: () => [],
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
  const disposable = activateProductModule(shell, createDashboardProjectModule(input));

  return {
    ...shell,
    dispose: () => disposable.dispose(),
  };
};
