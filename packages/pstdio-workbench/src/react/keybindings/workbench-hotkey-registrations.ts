import type { WebviewKeyboardShortcut } from "@pstdio/sdk/extensions";
import {
  getKeybindingSteps,
  type KeybindingSequence,
  type RegisteredCommand,
  type RegisteredKeybinding,
  type WorkbenchCore,
} from "../../core";
import type { KeyboardPresentation } from "../../core/controllers/keyboard/keyboard-presentations";
import { isShortcutBindingAvailable } from "../../core/controllers/keyboard/shortcut-catalog";
import { keyboardEntryKind } from "../../core/registries/keybindings/keyboard-entry-commands";
import { getNavigationTargetKey } from "../../core/registries/navigation/navigation-target-key";
import { runUserAction } from "../../core/shared/run-user-action";
import { prepareWorkbenchEditingCommand } from "../../extensions/bridge/webview-editing-adapter";
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
  filterKeybinding?: (binding: RegisteredKeybinding) => boolean;
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

const prepareCommand = async (workbench: WorkbenchCore, commandId: string, available: () => boolean) => {
  if (!available()) return false;
  const projectId = workbench.pages.store.getState().projectId;
  await prepareWorkbenchEditingCommand(workbench, commandId);
  return projectId === workbench.pages.store.getState().projectId && available();
};

const invokeCommand = (input: {
  workbench: WorkbenchCore;
  action: Extract<RegisteredKeybinding["action"], { kind: "command" }>;
  keybinding: RegisteredKeybinding;
  record: RegisteredCommand;
  available: () => boolean;
}) => {
  const { workbench, action, keybinding, record, available } = input;
  return runUserAction(workbench, record.command.label, async () => {
    if (!(await prepareCommand(workbench, action.commandId, available))) return;
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
    return workbench.navigation.openTarget(action);
  });
};

const shortcutRequestId = (binding: RegisteredKeybinding) =>
  JSON.stringify([getNavigationTargetKey(binding.action), binding.keybinding]);

export const createWorkbenchHotkeyRegistrations = (input: CreateWorkbenchHotkeyRegistrationsInput) => {
  const { workbench, disabled = false, commandIds, filterKeybinding } = input;
  if (!workbench.activation.isActive()) return [];
  const allowedCommandIds = commandIds ? new Set(commandIds) : undefined;
  let targets: KeyboardPresentation[] | undefined;
  const visibleTargets = () => (targets ??= workbench.keyboard.visibleTargets());
  const available = (expected: RegisteredKeybinding) => {
    if (!workbench.activation.isActive()) return false;
    const binding = workbench.keybindings
      .listActiveKeybindings()
      .find(
        (entry) =>
          workbench.keybindings.getId(entry) === workbench.keybindings.getId(expected) &&
          shortcutRequestId(entry) === shortcutRequestId(expected),
      );
    return binding !== undefined && isShortcutBindingAvailable(workbench, binding);
  };

  return workbench.keybindings.listActiveKeybindings().flatMap((keybinding, index) => {
    if (filterKeybinding && !filterKeybinding(keybinding)) return [];
    const action = keybinding.action;
    if (action.kind === "command") {
      if (allowedCommandIds && !allowedCommandIds.has(action.commandId)) return [];
      const record = workbench.commands.getCommand(action.commandId);
      if (!record) return [];
      const enabled = !disabled && isShortcutBindingAvailable(workbench, keybinding, visibleTargets);
      return [
        {
          id: record.command.id,
          entry: keyboardEntryKind(record.command.id),
          hotkey: normalizeWorkbenchKeybinding(keybinding.keybinding),
          enabled,
          ignoreInputs: !keybinding.allowInInputs,
          requestId: shortcutRequestId(keybinding),
          execute: () =>
            invokeCommand({
              workbench,
              action,
              keybinding,
              record,
              available: () => available(keybinding),
            }),
        } satisfies WorkbenchHotkeyRegistration,
      ];
    }
    if (allowedCommandIds) return [];
    return [
      {
        id: `workbench.keybinding.${index}`,
        entry: undefined,
        hotkey: normalizeWorkbenchKeybinding(keybinding.keybinding),
        enabled: !disabled && isShortcutBindingAvailable(workbench, keybinding, visibleTargets),
        ignoreInputs: !keybinding.allowInInputs,
        requestId: shortcutRequestId(keybinding),
        execute: () => {
          if (!available(keybinding)) return Promise.resolve();

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
