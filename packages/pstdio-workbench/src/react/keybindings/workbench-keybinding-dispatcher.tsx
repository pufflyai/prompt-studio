import { getKeybindingSteps, type KeybindingSequence, type WorkbenchCore } from "../../core";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { useTanStackWorkbenchHotkeys } from "./tanstack-hotkey-adapter";

export interface WorkbenchHotkeyRegistration {
  id: string;
  hotkey: KeybindingSequence;
  enabled: boolean;
  ignoreInputs: boolean;
  execute(): Promise<unknown>;
}

export interface CreateWorkbenchHotkeyRegistrationsInput {
  workbench: WorkbenchCore;
  disabled?: boolean;
  commandIds?: readonly string[];
}

export interface WorkbenchKeybindingDispatcherProps {
  workbench: WorkbenchCore;
  disabled?: boolean;
  commandIds?: readonly string[];
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

const normalizeWorkbenchKeybindingStep = (keybinding: string) =>
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

export const normalizeWorkbenchKeybinding = (keybinding: KeybindingSequence): KeybindingSequence => {
  const steps = getKeybindingSteps(keybinding).map(normalizeWorkbenchKeybindingStep);
  return steps.length === 1 ? (steps[0] ?? "") : steps;
};

export const createWorkbenchHotkeyRegistrations = (input: CreateWorkbenchHotkeyRegistrationsInput) => {
  const { workbench, disabled = false, commandIds } = input;
  const allowedCommandIds = commandIds ? new Set(commandIds) : undefined;

  return workbench.keybindings.listActiveKeybindings().flatMap((keybinding, index) => {
    const action = keybinding.action;
    if (action.kind === "command") {
      if (allowedCommandIds && !allowedCommandIds.has(action.commandId)) return [];
      const record = workbench.commands.getCommand(action.commandId);
      if (!record) return [];
      const enabled =
        !disabled &&
        workbench.commands.isCommandVisible(record.command.id, action.args) &&
        workbench.commands.isCommandEnabled(record.command.id, action.args);
      return [
        {
          id: record.command.id,
          hotkey: normalizeWorkbenchKeybinding(keybinding.keybinding),
          enabled,
          ignoreInputs: true,
          execute: () => workbench.navigation.openTarget(action),
        } satisfies WorkbenchHotkeyRegistration,
      ];
    }
    if (allowedCommandIds) return [];
    return [
      {
        id: `workbench.keybinding.${index}`,
        hotkey: normalizeWorkbenchKeybinding(keybinding.keybinding),
        enabled: !disabled,
        ignoreInputs: true,
        execute: () => workbench.navigation.openTarget(action),
      } satisfies WorkbenchHotkeyRegistration,
    ];
  });
};

export const WorkbenchKeybindingDispatcher = (props: WorkbenchKeybindingDispatcherProps) => {
  const { workbench, disabled, commandIds } = props;
  useWorkbenchStore(workbench.keybindings.store, (state) => state.keybindings);
  useWorkbenchStore(workbench.context.store, (state) => state.values);
  useWorkbenchStore(workbench.commands.store, (state) => state.commands);

  const registrations = createWorkbenchHotkeyRegistrations({ workbench, disabled, commandIds });
  useTanStackWorkbenchHotkeys(registrations);

  return null;
};
