import type { WebviewKeyboardShortcut } from "@pstdio/sdk/extensions";
import { getKeybindingSteps, type KeybindingSequence, type WorkbenchCore } from "../../core";
import { keyboardEntryKind } from "../../core/registries/keybindings/keyboard-entry-commands";
import { getNavigationTargetKey } from "../../core/registries/navigation/navigation-target-key";
import { runUserAction } from "../../core/shared/run-user-action";
import { hasCommandParameters } from "../command-palette/command-palette-params";

export interface WorkbenchHotkeyRegistration {
  id: string;
  hotkey: KeybindingSequence;
  enabled: boolean;
  ignoreInputs: boolean;
  requestId?: string;
  entry?: WebviewKeyboardShortcut["entry"];
  execute(): Promise<unknown>;
}

export interface CreateWorkbenchHotkeyRegistrationsInput {
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
  const available = new Set(
    workbench.keyboard
      .catalog(true)
      .filter((entry) => !entry.disabled)
      .map((entry) => entry.id),
  );

  return workbench.keybindings.listActiveKeybindings().flatMap((keybinding, index) => {
    const action = keybinding.action;
    if (action.kind === "command") {
      if (allowedCommandIds && !allowedCommandIds.has(action.commandId)) return [];
      const record = workbench.commands.getCommand(action.commandId);
      if (!record) return [];
      const enabled = !disabled && available.has(workbench.keybindings.getId(keybinding));
      return [
        {
          id: record.command.id,
          entry: keyboardEntryKind(record.command.id),
          hotkey: normalizeWorkbenchKeybinding(keybinding.keybinding),
          enabled,
          ignoreInputs: !keybinding.allowInInputs,
          requestId: JSON.stringify([getNavigationTargetKey(action), keybinding.keybinding]),
          execute: async () => {
            if (
              workbench.keyboard.catalog(true).find((entry) => entry.id === workbench.keybindings.getId(keybinding))
                ?.disabled !== false
            )
              return;
            if (workbench.keyboard.store.getState().active || keybinding.targetScope)
              return workbench.keyboard.invoke(workbench.keybindings.getId(keybinding));
            if (action.args === undefined && hasCommandParameters(record.command.params)) {
              const resource = workbench.getPrimaryResource();
              workbench.commandPalette.requestParams({
                record,
                label: record.command.label,
                context: resource ? { resource } : undefined,
              });
              return;
            }
            return runUserAction(workbench, record.command.label, () => workbench.navigation.openTarget(action));
          },
        } satisfies WorkbenchHotkeyRegistration,
      ];
    }
    if (allowedCommandIds) return [];
    return [
      {
        id: `workbench.keybinding.${index}`,
        entry: undefined,
        hotkey: normalizeWorkbenchKeybinding(keybinding.keybinding),
        enabled: !disabled && available.has(workbench.keybindings.getId(keybinding)),
        ignoreInputs: !keybinding.allowInInputs,
        requestId: JSON.stringify([getNavigationTargetKey(action), keybinding.keybinding]),
        execute: () => {
          if (
            workbench.keyboard.catalog(true).find((entry) => entry.id === workbench.keybindings.getId(keybinding))
              ?.disabled !== false
          )
            return Promise.resolve();
          return runUserAction(workbench, "Open", () =>
            workbench.keyboard.store.getState().active || keybinding.targetScope
              ? workbench.keyboard.invoke(workbench.keybindings.getId(keybinding))
              : workbench.navigation.openTarget(action),
          );
        },
      } satisfies WorkbenchHotkeyRegistration,
    ];
  });
};
