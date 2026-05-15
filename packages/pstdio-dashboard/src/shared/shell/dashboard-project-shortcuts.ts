import type { ShellCommandPaletteController } from "pstdio-shell/core";

export const DASHBOARD_CLOSE_OVERLAY_COMMAND_ID = "dashboard.closeOverlay";
export const DASHBOARD_OPEN_COMMAND_PALETTE_COMMAND_ID = "dashboard.openCommandPalette";
export const DASHBOARD_OPEN_COMMAND_PALETTE_COMMANDS_COMMAND_ID = "dashboard.openCommandPaletteCommands";
export const DASHBOARD_CHANGE_THEME_COMMAND_ID = "dashboard.changeTheme";
export const DASHBOARD_OPEN_SHORTCUT_HELP_COMMAND_ID = "dashboard.openShortcutHelp";
export const PROJECT_CREATE_TICKET_COMMAND_ID = "project.createTicket";
export const PROJECT_CREATE_SESSION_COMMAND_ID = "project.createSession";
export const PROJECT_GO_TO_TICKETS_COMMAND_ID = "project.goToTickets";
export const DASHBOARD_CLOSE_OVERLAY_KEYBINDING = "Escape";
export const DASHBOARD_OPEN_COMMAND_PALETTE_KEYBINDING = "Ctrl+Shift+P";
export const DASHBOARD_OPEN_COMMAND_PALETTE_COMMANDS_KEYBINDING = "Ctrl+Shift+.";
export const DASHBOARD_CHANGE_THEME_KEYBINDING = "Ctrl+Shift+K";
export const DASHBOARD_OPEN_SHORTCUT_HELP_KEYBINDING = "Ctrl+Shift+H";
export const PROJECT_CREATE_TICKET_KEYBINDING = "Ctrl+Shift+C";
export const PROJECT_CREATE_SESSION_KEYBINDING = "Ctrl+Shift+S";
export const PROJECT_GO_TO_TICKETS_KEYBINDING = "Ctrl+Shift+T";

interface DashboardShortcutInput {
  projectId: string;
  navigate: (path: string) => void;
  closeOverlay?: () => void;
  requestCreateTicket?: () => void;
  requestCreateSession?: () => void;
  openCommandPalette?: () => void;
  openCommandPaletteCommands?: () => void;
  openThemeMenu?: () => void;
  openShortcutHelp?: () => void;
}

interface DashboardShortcutRuntime {
  commandPalette: ShellCommandPaletteController;
}

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

const resolveDashboardShortcutExecute = (
  input: DashboardShortcutInput,
  runtime: DashboardShortcutRuntime,
  commandId: string,
) => {
  if (commandId === DASHBOARD_CLOSE_OVERLAY_COMMAND_ID) return input.closeOverlay ?? noop;
  if (commandId === PROJECT_CREATE_TICKET_COMMAND_ID) return input.requestCreateTicket ?? noop;
  if (commandId === PROJECT_CREATE_SESSION_COMMAND_ID) return input.requestCreateSession ?? noop;
  if (commandId === PROJECT_GO_TO_TICKETS_COMMAND_ID) {
    return () => input.navigate(`/projects/${input.projectId}/tickets`);
  }
  if (commandId === DASHBOARD_OPEN_COMMAND_PALETTE_COMMAND_ID) {
    return input.openCommandPalette ?? runtime.commandPalette.open;
  }
  if (commandId === DASHBOARD_OPEN_COMMAND_PALETTE_COMMANDS_COMMAND_ID) {
    return input.openCommandPaletteCommands ?? runtime.commandPalette.open;
  }
  if (commandId === DASHBOARD_CHANGE_THEME_COMMAND_ID) return input.openThemeMenu ?? noop;
  if (commandId === DASHBOARD_OPEN_SHORTCUT_HELP_COMMAND_ID) return input.openShortcutHelp ?? noop;

  return noop;
};

export const createDashboardShortcutCommands = (input: DashboardShortcutInput, runtime: DashboardShortcutRuntime) =>
  DASHBOARD_PROJECT_SHORTCUTS.map((shortcut) => ({
    ...shortcut,
    execute: resolveDashboardShortcutExecute(input, runtime, shortcut.commandId),
  }));
