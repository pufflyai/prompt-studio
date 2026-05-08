import { defaultThemePreferences, type ThemePreference, type ThemePreferenceOption } from "@pstdio/ui";
import type { LucideIcon } from "lucide-react";
import {
  CircleHelp,
  KanbanSquare,
  MessageCircle,
  Moon,
  Palette,
  Plus,
  SettingsIcon,
  Sun,
  Terminal,
} from "lucide-react";
import type { ExtensionCommandRecord, ExtensionMenuContribution, ExtensionRecord } from "pstdio-api-contracts";
import type { ShortcutBinding } from "@/features/shortcuts/shortcut-registry";
import { getSlotContributions } from "@/shared/extensions/contribution-mapping";

const EXTENSION_COMMAND_PANEL_SLOT_ID = "project.commandPanel";

export type CommandPaletteMode = "search" | "command";
export type CommandPaletteView = "main" | "theme";
type CommandPaletteEntryMode = CommandPaletteMode | "theme";
export type CommandPaletteEscapeAction = "clear" | "close" | "exit-view";

export interface CommandPaletteTicket {
  shorthand: string;
  title?: string | null;
  displayTitle?: string | null;
}

export type CommandPaletteAction =
  | { id: "create-ticket"; type: "create-ticket" }
  | { id: "create-session"; type: "create-session" }
  | { id: "open-shortcut-help"; type: "open-shortcut-help" }
  | { id: "open-theme-menu"; type: "open-theme-menu" }
  | { id: "navigate"; type: "navigate"; path: string }
  | { id: "theme"; type: "theme"; preference: ThemePreference }
  | { id: string; type: "extension-command"; commandId: string };

export interface CommandPaletteEntry {
  id: string;
  mode: CommandPaletteEntryMode;
  label: string;
  searchText: string;
  secondaryLabel?: string;
  shortcut?: ShortcutBinding;
  icon: LucideIcon;
  isSelected?: boolean;
  group?: string;
  action: CommandPaletteAction;
  run: () => void;
}

export interface CommandPaletteLabels {
  tickets: string;
  sessions: string;
  projectSettings: string;
  createTicket: string;
  createSession: string;
  keyboardShortcuts: string;
  changeTheme: string;
  themeLabel: (preference: ThemePreference) => string;
}

interface BuildCommandPaletteEntriesInput {
  projectId: string;
  tickets: CommandPaletteTicket[];
  currentTheme: ThemePreference;
  themePreferences?: readonly ThemePreferenceOption[];
  labels?: CommandPaletteLabels;
  extensions?: ExtensionRecord[];
  extensionCommands?: ExtensionCommandRecord[];
  extensionMenuContributions?: ExtensionMenuContribution[];
  run: (action: CommandPaletteAction) => void;
}

const defaultLabels: CommandPaletteLabels = {
  tickets: "Tickets",
  sessions: "Sessions",
  projectSettings: "Project settings",
  createTicket: "Create ticket",
  createSession: "Create session",
  keyboardShortcuts: "Keyboard shortcuts",
  changeTheme: "Change theme",
  themeLabel: (preference) => preference,
};

const themeIcons: Record<string, LucideIcon> = {
  "pstdio-light": Sun,
  "pstdio-dark": Moon,
};

const getThemeIcon = (preference: ThemePreference): LucideIcon => themeIcons[preference] ?? Palette;

export const resolveCommandPaletteMode = (query: string): CommandPaletteMode =>
  query.trimStart().startsWith(">") ? "command" : "search";

export const resolveCommandPaletteEscapeAction = (
  query: string,
  view: CommandPaletteView = "main",
): CommandPaletteEscapeAction => {
  if (view === "theme") {
    return "exit-view";
  }

  return query.length > 0 ? "clear" : "close";
};

const getEffectiveQuery = (query: string) =>
  resolveCommandPaletteMode(query) === "command" ? query.trimStart().slice(1).trim() : query.trim();

const getTicketLabel = (ticket: CommandPaletteTicket) => ticket.displayTitle ?? ticket.title ?? ticket.shorthand;

export const buildCommandPaletteEntries = (input: BuildCommandPaletteEntriesInput): CommandPaletteEntry[] => {
  const {
    projectId,
    tickets,
    currentTheme,
    run,
    themePreferences = defaultThemePreferences,
    extensions = [],
    extensionCommands = [],
    extensionMenuContributions = [],
  } = input;
  const labels = input.labels ?? defaultLabels;
  const projectPath = `/projects/${projectId}`;
  const extensionById = new Map(extensions.map((extension) => [extension.id, extension]));
  const commandById = new Map(extensionCommands.map((command) => [command.id, command]));

  const createEntry = (
    entry: Omit<CommandPaletteEntry, "run"> & { action: CommandPaletteAction },
  ): CommandPaletteEntry => ({
    ...entry,
    run: () => run(entry.action),
  });

  const paletteContributions = getSlotContributions(extensionMenuContributions, EXTENSION_COMMAND_PANEL_SLOT_ID);

  const extensionEntries = paletteContributions
    .map((contribution) => {
      const command = commandById.get(contribution.commandId);
      if (!command) return null;

      const label = contribution.label ?? command.title;
      const description = command.description;

      return createEntry({
        id: `extension:${command.id}`,
        mode: "command" as const,
        label,
        searchText: `${label} ${description ?? ""} ${command.namespace}`,
        secondaryLabel: description,
        icon: Terminal,
        group: extensionById.get(command.extensionId)?.displayName ?? command.namespace,
        action: { id: `extension:${command.id}`, type: "extension-command", commandId: command.id },
      });
    })
    .filter((entry): entry is CommandPaletteEntry => entry !== null);

  return [
    createEntry({
      id: "nav:tickets",
      mode: "search",
      label: labels.tickets,
      searchText: "tickets board backlog kanban",
      icon: KanbanSquare,
      action: { id: "navigate", type: "navigate", path: `${projectPath}/tickets` },
    }),
    createEntry({
      id: "nav:sessions",
      mode: "search",
      label: labels.sessions,
      searchText: "sessions chat agents",
      icon: MessageCircle,
      action: { id: "navigate", type: "navigate", path: `${projectPath}/sessions` },
    }),
    createEntry({
      id: "nav:settings",
      mode: "search",
      label: labels.projectSettings,
      searchText: "settings project tags statuses repositories agents",
      icon: SettingsIcon,
      action: { id: "navigate", type: "navigate", path: `${projectPath}/settings` },
    }),
    ...tickets.map((ticket) =>
      createEntry({
        id: `ticket:${ticket.shorthand}`,
        mode: "search",
        label: `${ticket.shorthand} ${getTicketLabel(ticket)}`,
        searchText: `${ticket.shorthand} ${getTicketLabel(ticket)}`,
        icon: KanbanSquare,
        action: { id: "navigate", type: "navigate", path: `${projectPath}/tickets/${ticket.shorthand}` },
      }),
    ),
    createEntry({
      id: "command:create-ticket",
      mode: "command",
      label: labels.createTicket,
      searchText: "create ticket new issue",
      icon: Plus,
      action: { id: "create-ticket", type: "create-ticket" },
    }),
    createEntry({
      id: "command:create-session",
      mode: "command",
      label: labels.createSession,
      searchText: "create session new chat agent",
      icon: MessageCircle,
      action: { id: "create-session", type: "create-session" },
    }),
    createEntry({
      id: "command:open-shortcut-help",
      mode: "command",
      label: labels.keyboardShortcuts,
      searchText: "keyboard shortcuts help",
      icon: CircleHelp,
      action: { id: "open-shortcut-help", type: "open-shortcut-help" },
    }),
    createEntry({
      id: "command:change-theme",
      mode: "command",
      label: labels.changeTheme,
      searchText: "theme color appearance preferences",
      shortcut: "Ctrl+Shift+K",
      icon: Palette,
      action: { id: "open-theme-menu", type: "open-theme-menu" },
    }),
    ...extensionEntries,
    ...themePreferences.map(({ id: preference }) =>
      createEntry({
        id: `theme:${preference}`,
        mode: "theme",
        label: labels.themeLabel(preference),
        searchText: `theme color ${preference} ${labels.themeLabel(preference)}`,
        icon: getThemeIcon(preference),
        isSelected: preference === currentTheme,
        action: { id: "theme", type: "theme", preference },
      }),
    ),
  ];
};

export const filterCommandPaletteEntries = (
  entries: CommandPaletteEntry[],
  query: string,
  view: CommandPaletteView = "main",
) => {
  const mode = view === "theme" ? "theme" : resolveCommandPaletteMode(query);
  const effectiveQuery = (view === "theme" ? query.trim() : getEffectiveQuery(query)).toLowerCase();

  return entries.filter((entry) => {
    if (entry.mode !== mode) return false;
    if (!effectiveQuery) return true;

    return `${entry.label} ${entry.searchText} ${entry.secondaryLabel ?? ""}`.toLowerCase().includes(effectiveQuery);
  });
};
