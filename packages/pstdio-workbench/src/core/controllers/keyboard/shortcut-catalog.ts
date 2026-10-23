import { getKeybindingSteps, type RegisteredKeybinding } from "../../registries/keybindings/keybinding-registry";
import { readShortcutPreferences, shortcutLayers } from "../../registries/keybindings/shortcut-preferences";
import { getNavigationTargetKey } from "../../registries/navigation/navigation-target-key";
import { scopeWorkbenchResourceContextValues } from "../../registries/resources/resource-registry";
import { matchesContextExpression } from "../../shared/context/context-key-service";
import type { WorkbenchCore } from "../../workbench-core-types";
import { type KeyboardPresentation, presentationResourceKey, visibleKeyboardTargets } from "./keyboard-presentations";
import { shortcutCommandArgs } from "./shortcut-command-args";
import { shortcutActionLabel } from "./shortcut-label";

export interface ResolvedShortcut {
  id: string;
  label: string;
  binding: RegisteredKeybinding;
  keys: string[];
  disabled: boolean;
  targets: KeyboardPresentation[];
}
export const shortcutLabel = (core: WorkbenchCore, binding: RegisteredKeybinding) =>
  binding.label ?? shortcutActionLabel(core, binding.action);
const applicable = (core: WorkbenchCore, binding: RegisteredKeybinding, target?: KeyboardPresentation) => {
  const values = target
    ? scopeWorkbenchResourceContextValues(core.context.snapshot(), target.resource)
    : core.context.snapshot();
  if (target) values["workbench.view.id"] = target.viewId;
  if (!matchesContextExpression(values, binding.when)) return false;
  if (binding.action.kind !== "command") return true;
  const context = target ? { resource: target.resource, region: target.region } : undefined;
  const record = core.commands.getCommand(binding.action.commandId);
  if (!record) return false;
  const args = shortcutCommandArgs(record.command.params, binding.action.args, context);
  return (
    core.commands.isCommandVisible(binding.action.commandId, args, context) &&
    core.commands.isCommandEnabled(binding.action.commandId, args, context)
  );
};
export const extensionShortcutAlias = (core: WorkbenchCore, extensionId: string) =>
  readShortcutPreferences(core.preferences).aliases[extensionId];
export const resolveShortcutCatalog = (
  core: WorkbenchCore,
  visibleTargets = visibleKeyboardTargets(core),
): ResolvedShortcut[] =>
  core.keybindings.listCatalog().map((declared) => {
    const binding = core.keybindings.resolve(declared);
    const prefix: string[] = [];
    if (binding.layer) prefix.push(shortcutLayers[binding.layer]);
    if (binding.layer === "extensions" && binding.sourceExtensionId) {
      const alias = extensionShortcutAlias(core, binding.sourceExtensionId);
      if (alias) prefix.push(...alias.toUpperCase());
      else prefix.push(binding.sourceExtensionId.toUpperCase());
    }
    let targets =
      (binding.targetScope && binding.targetScope !== "project") || binding.layer === "current"
        ? visibleTargets.filter((target) => applicable(core, binding, target))
        : [];
    if (binding.targetScope === "resource") {
      const resources = new Set<string>();
      targets = targets.filter((target) => {
        if (!target.resource) return false;
        const key = `${getNavigationTargetKey(binding.action)}:${presentationResourceKey(target)}`;
        if (resources.has(key)) return false;
        resources.add(key);
        return true;
      });
    }
    const contextual = Boolean(binding.targetScope && binding.targetScope !== "project") || binding.layer === "current";
    return {
      id: core.keybindings.getId(declared),
      label: shortcutLabel(core, binding),
      binding,
      keys: [...prefix, ...getKeybindingSteps(binding.keybinding).map((key) => key.toUpperCase())],
      disabled: binding.disabled || (contextual ? !targets.length : !applicable(core, binding)),
      targets,
    };
  });
export const isShortcutTargetAvailable = (
  core: WorkbenchCore,
  shortcut: ResolvedShortcut,
  target: KeyboardPresentation,
) =>
  core.keyboard
    .visibleTargets()
    .some(
      (current) =>
        current.id === target.id &&
        presentationResourceKey(current) === presentationResourceKey(target) &&
        applicable(core, shortcut.binding, current),
    );
