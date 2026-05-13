import { Palette, type PaletteEntry, PaletteShortcut } from "@pstdio/ui";
import { Search } from "lucide-react";
import type { ReactNode } from "react";
import {
  type Command,
  type MenuPath,
  type RegisteredCommand,
  type RegisteredMenuAction,
  type ShellCore,
  workbenchCommandPaletteMenuPath,
} from "../core";
import { ShellIcon } from "./shell-icons";

interface ShellCommandPaletteProps {
  shell: ShellCore;
  open: boolean;
  menuPath?: MenuPath;
  initialQuery?: string;
  onClose: () => void;
  onCommandError?: (error: unknown) => void;
  refresh?: () => void;
}

interface ShellCommandPaletteEntry extends PaletteEntry {
  commandId: string;
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
  onCommandError?: (error: unknown) => void;
  refresh: () => void;
}): ShellCommandPaletteEntry | null => {
  const { action, onClose, onCommandError, record, refresh, shell, shortcutByCommandId } = input;
  const args = action?.args;

  if (!shell.commands.isCommandVisible(record.command.id, args)) return null;

  const label = action?.label ?? record.command.label;
  const icon = action?.icon ?? record.command.icon;
  const group = action?.group ?? record.command.category;

  return {
    id: `shell-command:${record.command.id}`,
    commandId: record.command.id,
    label,
    searchText: getCommandSearchText(record.command, label),
    description: record.command.description,
    group,
    icon: icon ? <ShellIcon name={icon} /> : undefined,
    shortcut: getShortcut(shortcutByCommandId.get(record.command.id)),
    onActivate: () => {
      onClose();
      void shell.commands.executeCommand(record.command.id, args).then(refresh).catch(onCommandError);
    },
  };
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

export const ShellCommandPalette = (props: ShellCommandPaletteProps) => {
  const {
    shell,
    open,
    menuPath = workbenchCommandPaletteMenuPath,
    initialQuery = "",
    onClose,
    onCommandError,
    refresh = () => undefined,
  } = props;
  const shortcutByCommandId = createShortcutByCommandId(shell);
  const entries = listCommandRecords(shell, menuPath)
    .map(({ record, action }) =>
      createEntry({ shell, record, action, shortcutByCommandId, onClose, onCommandError, refresh }),
    )
    .filter((entry): entry is ShellCommandPaletteEntry => entry !== null);

  return (
    <Palette
      open={open}
      entries={entries}
      initialQuery={initialQuery}
      inputIcon={<Search size={16} aria-hidden="true" />}
      placeholder="Run command"
      emptyLabel="No shell commands found."
      onClose={onClose}
    />
  );
};
