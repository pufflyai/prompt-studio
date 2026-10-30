import { getKeybindingSteps } from "../../registries/keybindings/keybinding-registry";
import { getNavigationTargetKey } from "../../registries/navigation/navigation-target-key";
import type { WorkbenchCore } from "../../workbench-core-types";
import type { ResolvedShortcut } from "./shortcut-catalog";
import { groupShortcutMatches } from "./shortcut-matches";

const layerGroups = {
  view: "Panels and tabs",
  go: "Navigation",
  create: "Create",
  current: "Current view",
  settings: "Settings",
  help: "Current view",
  extensions: "Current view",
};

const referenceGroup = (core: WorkbenchCore, shortcut: ResolvedShortcut, owners: Record<string, string>) => {
  const action = shortcut.binding.action;
  const command = action.kind === "command" ? core.commands.getCommand(action.commandId)?.command : undefined;
  if (command?.category && !["Dashboard", "Workbench", "Core"].includes(command.category)) return command.category;
  const resource = shortcut.targets.find((target) => target.resource)?.resource;
  if (resource) {
    const kind = core.resources.getKind(resource.type, resource.extensionId);
    if (kind) return kind.label;
  }
  const owner = shortcut.binding.sourceExtensionId;
  const kinds = owner ? core.resources.listKinds().filter((kind) => kind.extensionId === owner) : [];
  if (kinds.length === 1) return kinds[0]!.label;
  if (owner && owner !== "pstdio") return owners[owner] ?? shortcut.binding.sourceExtensionLabel ?? "Tools";
  return shortcut.binding.layer ? layerGroups[shortcut.binding.layer] : "Workbench";
};

/** One resource action owns every chord that invokes it; internal unassigned commands are not shortcuts. */
export const createShortcutReference = (
  core: WorkbenchCore,
  catalog: ResolvedShortcut[],
  owners: Record<string, string> = {},
) =>
  groupShortcutMatches(catalog.filter((shortcut) => getKeybindingSteps(shortcut.binding.keybinding).length > 0))
    .map((shortcuts) => {
      const unique = new Map<string, ResolvedShortcut>();
      for (const shortcut of shortcuts) {
        const key = shortcut.keys.join("\0");
        if (!unique.has(key) || unique.get(key)!.disabled) unique.set(key, shortcut);
      }
      const choices = [...unique.values()];
      const shortcut = choices.find((choice) => !choice.disabled) ?? choices[0]!;
      return {
        id: getNavigationTargetKey(shortcut.binding.action),
        label: shortcut.label,
        group: referenceGroup(core, choices.find((choice) => choice.binding.layer) ?? shortcut, owners),
        disabled: choices.every((choice) => choice.disabled),
        shortcuts: choices,
      };
    })
    .sort((a, b) => a.group.localeCompare(b.group, "en") || a.label.localeCompare(b.label, "en"));
