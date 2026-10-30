import { getKeybindingSteps, type RegisteredKeybinding } from "../../registries/keybindings/keybinding-registry";
import { sharedShortcutLayer, shortcutLayers } from "../../registries/keybindings/shortcut-preferences";
import type { NavigationTarget } from "../../registries/navigation/navigation-registry";
import { getNavigationTargetKey } from "../../registries/navigation/navigation-target-key";
import { scopeWorkbenchResourceContextValues } from "../../registries/resources/resource-registry";
import { matchesContextExpression } from "../../shared/context/context-key-service";
import type { WorkbenchCore } from "../../workbench-core-types";
import { type KeyboardPresentation, presentationResourceKey, visibleKeyboardTargets } from "./keyboard-presentations";
import { shortcutCommandArgs } from "./shortcut-command-args";
import { shortcutActionLabel } from "./shortcut-label";

const navigationLabel = (label: string) => {
  if (/^back to\s+/i.test(label)) return label;
  const direction = /^(?:navigate|go) (back|forward)$/i.exec(label);
  if (direction) return `Go ${direction[1]!.toLowerCase()}`;
  const destination = label.replace(/^(?:open|go to)\s+/i, "");
  return `Go to ${destination.charAt(0).toLowerCase()}${destination.slice(1)}`;
};

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
type AvailabilityCore = Pick<WorkbenchCore, "context" | "commands" | "keyboard">;
const applicable = (core: AvailabilityCore, binding: RegisteredKeybinding, target?: KeyboardPresentation) => {
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
const isContextual = (binding: RegisteredKeybinding) =>
  binding.targetScope ? binding.targetScope !== "project" : binding.layer === "current";

/** Direct input dispatch only needs the assigned binding's live availability. */
export const isShortcutBindingAvailable = (
  core: AvailabilityCore,
  binding: RegisteredKeybinding,
  targets: () => KeyboardPresentation[] = () => core.keyboard.visibleTargets(),
) =>
  isContextual(binding)
    ? targets().some(
        (target) => (binding.targetScope !== "resource" || target.resource) && applicable(core, binding, target),
      )
    : applicable(core, binding);

/** A tooltip for one direct action does not need discovery labels or layered shortcuts. */
export const directShortcutHint = (
  core: AvailabilityCore & Pick<WorkbenchCore, "keybindings">,
  action: NavigationTarget,
) => {
  const key = getNavigationTargetKey(action);
  const binding = core.keybindings
    .listActiveKeybindings()
    .reverse()
    .find((binding) => getNavigationTargetKey(binding.action) === key && isShortcutBindingAvailable(core, binding));
  return binding ? getKeybindingSteps(binding.keybinding).join(" ") : undefined;
};

export const resolveShortcutCatalog = (
  core: WorkbenchCore,
  visibleTargets = visibleKeyboardTargets(core),
): ResolvedShortcut[] => {
  const bindings = core.keybindings.listCatalog().map((declared) => ({
    declared,
    binding: core.keybindings.resolve(declared),
  }));
  const navigation = new Set(
    bindings
      .filter(({ binding }) => binding.layer === "go")
      .map(({ binding }) => getNavigationTargetKey(binding.action)),
  );
  return bindings.map(({ declared, binding }) => {
    const navigates = binding.action.kind === "page" || navigation.has(getNavigationTargetKey(binding.action));
    const prefix: string[] = [];
    if (binding.layer) prefix.push(shortcutLayers[sharedShortcutLayer(binding.layer)]);
    const contextual = isContextual(binding);
    let targets = contextual ? visibleTargets.filter((target) => applicable(core, binding, target)) : [];
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
    return {
      id: core.keybindings.getId(declared),
      label: navigates ? navigationLabel(shortcutLabel(core, binding)) : shortcutLabel(core, binding),
      binding,
      keys: [...prefix, ...getKeybindingSteps(binding.keybinding).map((key) => key.toUpperCase())],
      disabled: binding.disabled || (contextual ? !targets.length : !applicable(core, binding)),
      targets,
    };
  });
};
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
