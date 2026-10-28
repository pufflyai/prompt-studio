import { keyboardEntryKind } from "../../registries/keybindings/keyboard-entry-commands";
import { getNavigationTargetKey } from "../../registries/navigation/navigation-target-key";
import type { InternalWorkbenchStore } from "../../shared/store/workbench-store";
import type { WorkbenchCore } from "../../workbench-core-types";
import type { KeyboardActionChoice, KeyboardState } from "./keyboard-controller";
import { type KeyboardPresentation, regionLabel } from "./keyboard-presentations";
import { isShortcutTargetAvailable, type ResolvedShortcut } from "./shortcut-catalog";
import { shortcutCommandArgs } from "./shortcut-command-args";

const needsEditableParameters = (
  record: import("../../registries/commands/command-registry").RegisteredCommand,
  args: unknown,
) =>
  args === undefined && Object.values(record.command.params ?? {}).some((param) => param.resolvedFrom !== "resource");

export const createKeyboardActionRunner = (input: {
  getCore(): WorkbenchCore;
  store: InternalWorkbenchStore<KeyboardState>;
  catalog(): ResolvedShortcut[];
  stop(restore?: boolean): void;
  message(text: string): void;
  select(title: string, choices: KeyboardActionChoice[]): void;
  resetSelection(): void;
  refresh(): void;
}) => {
  const { getCore, store, catalog, stop, message, select, resetSelection, refresh } = input;
  const restoreSelectorPath = (path: string[]) => {
    if (store.getState().active && store.getState().selection) store.setState({ path });
  };
  const invoke = async (shortcut: ResolvedShortcut, target?: KeyboardPresentation) => {
    const core = getCore();
    if (target && !isShortcutTargetAvailable(core, shortcut, target)) {
      stop();
      message("This target is no longer available. Nothing ran.");
      return;
    }
    const current = catalog().find((candidate) => candidate.id === shortcut.id);
    if (
      !current ||
      current.disabled ||
      getNavigationTargetKey(current.binding.action) !== getNavigationTargetKey(shortcut.binding.action)
    ) {
      stop();
      message("This action is no longer available.");
      return;
    }
    const { binding } = current;
    const context = target ? { resource: target.resource, region: target.region } : undefined;
    const keepMode = binding.action.kind === "command" && keyboardEntryKind(binding.action.commandId) === "tab";
    const path = store.getState().path;
    if (!keepMode) stop(false);
    else {
      resetSelection();
    }
    if (binding.action.kind === "command") {
      const action = binding.action;
      const record = core.commands.getCommand(action.commandId)!;
      if (needsEditableParameters(record, action.args)) {
        stop(false);
        core.commandPalette.requestParams({ record, label: shortcut.label, context });
        return;
      }
      const args = shortcutCommandArgs(record.command.params, action.args, context);
      await core.commands.executeCommand(action.commandId, args, context);
    } else await core.navigation.openTarget(binding.action);
    if (!keepMode) restoreSelectorPath(path);
    if (keepMode) {
      const selected = core.keyboard
        .visibleTargets()
        .find((target) => target.id === core.layout.getLayout().activeWidgetId);
      if (selected) store.setState({ selectedId: selected.id, selectedRegion: selected.region });
    }
    refresh();
  };
  const run = async (shortcut: ResolvedShortcut) => {
    if (shortcut.targets.length > 1)
      select(
        shortcut.label,
        shortcut.targets.map((target, index) => ({
          key: String(index + 1),
          label: `${target.label} · ${regionLabel(target.region)}`,
          choose: () => invoke(shortcut, target),
        })),
      );
    else await invoke(shortcut, shortcut.targets[0]);
  };
  return run;
};
