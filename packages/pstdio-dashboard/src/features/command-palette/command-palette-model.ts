import type { ExtensionCommandPaletteContribution, ExtensionCommandRecord, ExtensionRecord } from "@pstdio/sdk/api";
import { matchesResourceWhen } from "@pstdio/sdk/extensions";
import {
  DEFAULT_PALETTE_ASSET_LIMIT,
  defaultThemePreferences,
  filterPaletteEntries,
  type PaletteSearchEntry,
  type ThemePreference,
  type ThemePreferenceOption,
} from "@pstdio/ui";
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
import type { ShortcutBinding } from "@/features/shortcuts/shortcut-registry";
import { resolveLabel } from "@/shared/extensions/localized-label";
import type { ExtensionResourceContext } from "@/shared/extensions/types";

export const DEFAULT_COMMAND_PALETTE_ASSET_LIMIT = DEFAULT_PALETTE_ASSET_LIMIT;

export type CommandPaletteMode = "search" | "command";
export type CommandPaletteView = "main" | "theme";
type CommandPaletteEntryMode = CommandPaletteMode | "theme";
type CommandPaletteAssetType = "ticket" | "session" | "extension-command" | "theme";
export type CommandPaletteEscapeAction = "clear" | "close" | "exit-view";

export interface CommandPaletteTicket {
  shorthand: string;
  title?: string | null;
  displayTitle?: string | null;
}

export interface CommandPaletteSession {
  id: string;
  title: string;
}

export type CommandPaletteAction =
  | { id: "create-ticket"; type: "create-ticket" }
  | { id: "create-session"; type: "create-session" }
  | { id: "open-shortcut-help"; type: "open-shortcut-help" }
  | { id: "open-theme-menu"; type: "open-theme-menu" }
  | { id: "navigate"; type: "navigate"; path: string }
  | { id: "theme"; type: "theme"; preference: ThemePreference }
  | { id: string; type: "extension-command"; commandId: string; resource?: ExtensionResourceContext };

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
  assetType?: CommandPaletteAssetType;
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
  sessions: CommandPaletteSession[];
  currentTheme: ThemePreference;
  themePreferences?: readonly ThemePreferenceOption[];
  labels?: CommandPaletteLabels;
  extensions?: ExtensionRecord[];
  extensionCommands?: ExtensionCommandRecord[];
  extensionCommandPaletteContributions?: ExtensionCommandPaletteContribution[];
  selectedResource?: ExtensionResourceContext;
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
    sessions,
    currentTheme,
    run,
    themePreferences = defaultThemePreferences,
    extensions = [],
    extensionCommands = [],
    extensionCommandPaletteContributions = [],
    selectedResource,
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

  const extensionEntries = extensionCommandPaletteContributions
    .filter((contribution) => matchesResourceWhen(contribution.when, selectedResource?.type))
    .map((contribution) => {
      const command = commandById.get(contribution.commandId);
      if (!command) return null;

      const label = resolveLabel(contribution.label ?? command.title);
      const description = resolveLabel(command.description);
      const extension = extensionById.get(command.extensionId);

      return createEntry({
        id: `extension:${command.id}`,
        mode: "command" as const,
        label,
        searchText: `${label} ${description ?? ""} ${extension?.name ?? ""}`,
        secondaryLabel: description,
        icon: Terminal,
        group: extension?.displayName ?? extension?.name ?? "Extensions",
        assetType: "extension-command",
        action: {
          id: `extension:${command.id}`,
          type: "extension-command",
          commandId: command.id,
          resource: selectedResource,
        },
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
        assetType: "ticket",
        action: { id: "navigate", type: "navigate", path: `${projectPath}/tickets/${ticket.shorthand}` },
      }),
    ),
    ...sessions.map((session) =>
      createEntry({
        id: `session:${session.id}`,
        mode: "search",
        label: session.title,
        searchText: `${session.title} session chat agent`,
        icon: MessageCircle,
        assetType: "session",
        action: { id: "navigate", type: "navigate", path: `${projectPath}/sessions/${session.id}` },
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
    ...themePreferences.map((themePreference: ThemePreferenceOption) => {
      const preference = themePreference.id;
      const title = "title" in themePreference ? themePreference.title : undefined;
      const label = title ?? labels.themeLabel(preference);
      return createEntry({
        id: `theme:${preference}`,
        mode: "theme",
        label,
        searchText: `theme color ${preference} ${label}`,
        icon: getThemeIcon(preference),
        isSelected: preference === currentTheme,
        assetType: "theme",
        action: { id: "theme", type: "theme", preference },
      });
    }),
  ];
};

type FilterableCommandPaletteEntry = PaletteSearchEntry & {
  mode: CommandPaletteEntryMode;
  assetType?: CommandPaletteAssetType;
};

export const filterCommandPaletteEntries = <T extends FilterableCommandPaletteEntry>(
  entries: T[],
  query: string,
  view: CommandPaletteView = "main",
  selectedMode?: CommandPaletteMode,
) => {
  const mode = view === "theme" ? "theme" : (selectedMode ?? resolveCommandPaletteMode(query));

  return filterPaletteEntries(entries, {
    query,
    mode,
    defaultAssetLimit: DEFAULT_COMMAND_PALETTE_ASSET_LIMIT,
    getEffectiveQuery: (value: string) => (view === "theme" ? value.trim() : getEffectiveQuery(value)),
  });
};
