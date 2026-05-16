import type { WorkbenchCore } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { useTanStackWorkbenchHotkeys } from "./tanstack-hotkey-adapter";

export interface WorkbenchHotkeyRegistration {
  commandId: string;
  hotkey: string;
  enabled: boolean;
  ignoreInputs: boolean;
  execute(): Promise<unknown>;
}

export interface CreateWorkbenchHotkeyRegistrationsInput {
  workbench: WorkbenchCore;
  disabled?: boolean;
}

export interface WorkbenchKeybindingDispatcherProps {
  workbench: WorkbenchCore;
  disabled?: boolean;
}

const keyAliases: Record<string, string> = {
  alt: "Alt",
  cmd: "Meta",
  command: "Meta",
  ctrl: "Control",
  control: "Control",
  meta: "Meta",
  mod: "Mod",
  option: "Alt",
  shift: "Shift",
};

export const normalizeWorkbenchKeybinding = (keybinding: string) =>
  keybinding
    .split("+")
    .map((part) => {
      const trimmed = part.trim();
      const alias = keyAliases[trimmed.toLowerCase()];
      if (alias) return alias;
      if (trimmed.length === 1) return trimmed.toUpperCase();
      return trimmed.slice(0, 1).toUpperCase() + trimmed.slice(1);
    })
    .join("+");

export const createWorkbenchHotkeyRegistrations = (input: CreateWorkbenchHotkeyRegistrationsInput) => {
  const { workbench, disabled = false } = input;

  return workbench.keybindings.listActiveKeybindings().flatMap((keybinding) => {
    const record = workbench.commands.getCommand(keybinding.commandId);
    if (!record) return [];

    const enabled =
      !disabled &&
      workbench.commands.isCommandVisible(record.command.id, keybinding.args) &&
      workbench.commands.isCommandEnabled(record.command.id, keybinding.args);

    return [
      {
        commandId: record.command.id,
        hotkey: normalizeWorkbenchKeybinding(keybinding.keybinding),
        enabled,
        ignoreInputs: true,
        execute: () => workbench.commands.executeCommand(record.command.id, keybinding.args),
      } satisfies WorkbenchHotkeyRegistration,
    ];
  });
};

export const WorkbenchKeybindingDispatcher = (props: WorkbenchKeybindingDispatcherProps) => {
  const { workbench, disabled } = props;
  useWorkbenchStore(workbench.keybindings.store, (state) => state.keybindings);
  useWorkbenchStore(workbench.context.store, (state) => state.values);
  useWorkbenchStore(workbench.commands.store, (state) => state.commands);

  const registrations = createWorkbenchHotkeyRegistrations({ workbench, disabled });
  useTanStackWorkbenchHotkeys(registrations);

  return null;
};
