import { Palette, type PaletteEntry, type PaletteMode, PaletteShortcut } from "@pstdio/ui";
import { Search, Terminal } from "lucide-react";
import type { ReactNode } from "react";
import {
  type Command,
  type MenuPath,
  type RegisteredCommand,
  type RegisteredMenuAction,
  type ResourceBrowseEntry,
  type ShellCore,
  workbenchCommandPaletteMenuPath,
} from "../../core";
import { ShellIcon } from "../shared/icon";

const SEARCH_MODE_ID = "search";
const COMMAND_MODE_ID = "command";

const shellPaletteModes: PaletteMode[] = [{ id: SEARCH_MODE_ID }, { id: COMMAND_MODE_ID, inputPrefix: ">" }];

interface ShellCommandPaletteProps {
  shell: ShellCore;
  open: boolean;
  menuPath?: MenuPath;
  initialQuery?: string;
  onClose: () => void;
}

export interface ShellCommandPaletteEntry extends PaletteEntry {
  commandId: string;
}

export interface ShellResourcePaletteEntry extends PaletteEntry {
  resourceUri: string;
}

interface ShellCommandPaletteRecord {
  record: RegisteredCommand;
  action?: RegisteredMenuAction;
}

const getCommandSearchText = (command: Command, label: string) =>
  [label, command.description, command.category].filter(Boolean).join(" ");

const createShortcutByCommandId = (shell: ShellCore) =>
  new Map(shell.keybindings.listActiveKeybindings().map((keybinding) => [keybinding.commandId, keybinding.keybinding]));

const getShortcut = (binding: string | undefined): ReactNode =>
  binding ? <PaletteShortcut binding={binding} /> : undefined;

const createEntry = (input: {
  shell: ShellCore;
  record: RegisteredCommand;
  action?: RegisteredMenuAction;
  shortcutByCommandId: Map<string, string>;
  onClose: () => void;
}): ShellCommandPaletteEntry | null => {
  const { action, onClose, record, shell, shortcutByCommandId } = input;
  const args = action?.args;

  if (!shell.commands.isCommandVisible(record.command.id, args)) return null;

  const label = action?.label ?? record.command.label;
  const icon = action?.icon ?? record.command.icon;
  const group = action?.group ?? record.command.category;

  return {
    id: `shell-command:${record.command.id}`,
    commandId: record.command.id,
    mode: COMMAND_MODE_ID,
    label,
    searchText: getCommandSearchText(record.command, label),
    description: record.command.description,
    group,
    icon: icon ? <ShellIcon name={icon} /> : undefined,
    shortcut: getShortcut(shortcutByCommandId.get(record.command.id)),
    onActivate: () => {
      onClose();
      void shell.commands.executeCommand(record.command.id, args).catch(() => undefined);
    },
  };
};

const createResourceEntry = (input: {
  shell: ShellCore;
  entry: ResourceBrowseEntry;
  onClose: () => void;
}): ShellResourcePaletteEntry => {
  const { entry, onClose, shell } = input;
  const { resource } = entry;
  const label = entry.resource.label ?? entry.resource.uri;
  const icon = resource.icon ?? shell.resources.getKind(resource.kind)?.icon;

  return {
    id: `shell-resource:${resource.uri}`,
    resourceUri: resource.uri,
    mode: SEARCH_MODE_ID,
    label,
    searchText: entry.searchText ?? label,
    description: entry.description,
    group: entry.group,
    icon: icon ? <ShellIcon name={icon} /> : undefined,
    onActivate: () => {
      onClose();
      void shell.resources.openResource(resource).catch(() => undefined);
    },
  };
};

const getRecordGroup = (item: ShellCommandPaletteRecord) => item.action?.group ?? item.record.command.category ?? "";

const getRecordOrder = (item: ShellCommandPaletteRecord) => item.action?.order ?? 0;

const byCommandPaletteGroup = (left: ShellCommandPaletteRecord, right: ShellCommandPaletteRecord) => {
  const groupComparison = getRecordGroup(left).localeCompare(getRecordGroup(right));
  if (groupComparison !== 0) return groupComparison;

  return getRecordOrder(left) - getRecordOrder(right);
};

const listCommandRecords = (shell: ShellCore, menuPath?: MenuPath) => {
  if (!menuPath) {
    return shell.commands.listCommands().map((record) => ({ record, action: undefined }));
  }

  return shell.menus
    .listMenuActions(menuPath)
    .filter((action) => shell.context.matches(action.when))
    .map((action) => {
      const record = shell.commands.getCommand(action.commandId);
      return record ? { record, action } : null;
    })
    .filter((item): item is { record: RegisteredCommand; action: RegisteredMenuAction } => item !== null);
};

export const createShellCommandPaletteEntries = (input: {
  shell: ShellCore;
  menuPath?: MenuPath;
  onClose: () => void;
}) => {
  const { menuPath, onClose, shell } = input;
  const shortcutByCommandId = createShortcutByCommandId(shell);

  return listCommandRecords(shell, menuPath)
    .sort(byCommandPaletteGroup)
    .map(({ record, action }) => createEntry({ shell, record, action, shortcutByCommandId, onClose }))
    .filter((entry): entry is ShellCommandPaletteEntry => entry !== null);
};

export const createShellResourcePaletteEntries = (input: { shell: ShellCore; query: string; onClose: () => void }) => {
  const { onClose, query, shell } = input;
  return shell.resources.listResources(query).map((entry) => createResourceEntry({ shell, entry, onClose }));
};

export const ShellCommandPalette = (props: ShellCommandPaletteProps) => {
  const { shell, open, menuPath = workbenchCommandPaletteMenuPath, initialQuery = "", onClose } = props;
  const commandEntries = createShellCommandPaletteEntries({ shell, menuPath, onClose });
  const resourceEntries = createShellResourcePaletteEntries({ shell, query: initialQuery, onClose });
  const entries = [...resourceEntries, ...commandEntries];

  return (
    <Palette
      open={open}
      entries={entries}
      initialQuery={initialQuery}
      modes={shellPaletteModes}
      inputIcon={({ mode }) =>
        mode === COMMAND_MODE_ID ? <Terminal size={16} aria-hidden="true" /> : <Search size={16} aria-hidden="true" />
      }
      placeholder={({ mode }) => (mode === COMMAND_MODE_ID ? "Run command" : "Search resources")}
      emptyLabel="No results found."
      onClose={onClose}
    />
  );
};
