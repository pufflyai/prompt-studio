import type { ShellCore } from "pstdio-shell/core";
export interface ShortcutHelpEntry {
  id: string;
  actionLabel: string;
  binding: string;
  category?: string;
}

export const buildShortcutHelpEntries = (shell?: ShellCore) => {
  if (!shell) return [];

  const entries: ShortcutHelpEntry[] = [];

  for (const keybinding of shell.keybindings.listActiveKeybindings()) {
    const record = shell.commands.getCommand(keybinding.commandId);
    if (!record || !shell.commands.isCommandVisible(keybinding.commandId, keybinding.args)) continue;

    const entry: ShortcutHelpEntry = {
      id: `${keybinding.commandId}:${keybinding.keybinding}`,
      actionLabel: record.command.label,
      binding: keybinding.keybinding,
    };

    if (record.command.category) {
      entry.category = record.command.category;
    }

    entries.push(entry);
  }

  return entries;
};
