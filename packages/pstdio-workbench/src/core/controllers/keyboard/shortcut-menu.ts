import { getKeybindingSteps } from "../../registries/keybindings/keybinding-registry";
import { shortcutLayers } from "../../registries/keybindings/shortcut-preferences";
import { getNavigationTargetKey } from "../../registries/navigation/navigation-target-key";
import type { KeyboardState } from "./keyboard-controller";
import type { ResolvedShortcut } from "./shortcut-catalog";
import { groupShortcutMatches } from "./shortcut-matches";

export const shortcutOpeningChord = (catalog: ResolvedShortcut[]) =>
  getKeybindingSteps(
    catalog.find((shortcut) => shortcut.id === "workbench.keyboard.leader")?.binding.keybinding ?? "",
  ).join(" ");

const actionChoiceNumber = (shortcut: ResolvedShortcut, catalog: ResolvedShortcut[]) => {
  if (shortcut.disabled || !shortcut.binding.layer) return undefined;
  const groups = groupShortcutMatches(matchShortcutPath(catalog, shortcut.keys).candidates);
  if (groups.length <= 1) return undefined;
  const key = getNavigationTargetKey(shortcut.binding.action);
  const index = groups.findIndex((group) => getNavigationTargetKey(group[0]!.binding.action) === key);
  return index < 0 ? undefined : String(index + 1);
};

export const shortcutDisplayKeys = (
  shortcut: ResolvedShortcut,
  openingChord: string,
  catalog: ResolvedShortcut[] = [],
) => {
  if (!shortcut.binding.layer) return getKeybindingSteps(shortcut.binding.keybinding);
  const number = actionChoiceNumber(shortcut, catalog);
  return [openingChord, ...shortcut.keys, ...(number ? [number] : [])];
};

export const shortcutPathLabels = (_catalog: ResolvedShortcut[], path: string[]) =>
  path.map((key) => {
    const layer = Object.entries(shortcutLayers).find(([, value]) => value === key)?.[0];
    if (layer === "current") return "Current view";
    return layer ? layer[0]!.toUpperCase() + layer.slice(1) : key;
  });

export const shortcutMenuEntries = (catalog: ResolvedShortcut[], path: string[]) => {
  if (!path.length)
    return Object.entries(shortcutLayers)
      .filter(([, key]) =>
        catalog.some((shortcut) => shortcut.binding.layer && !shortcut.disabled && shortcut.keys[0] === key),
      )
      .map(([name, key]) => ({
        key,
        label: name === "current" ? "Current view" : name[0]!.toUpperCase() + name.slice(1),
        shortcut: undefined,
      }));
  const available = catalog.filter(
    (shortcut) =>
      shortcut.binding.layer &&
      !shortcut.disabled &&
      shortcut.keys.slice(0, path.length).every((key, index) => key === path[index]),
  );
  const grouped = new Map<string, { key: string; label: string; shortcut?: ResolvedShortcut }>();
  for (const shortcut of available) {
    const key = shortcut.keys[path.length];
    if (!key) continue;
    const terminal = shortcut.keys.length === path.length + 1;
    const label = terminal
      ? shortcut.label
      : (Object.entries(shortcutLayers).find(([, value]) => value === key)?.[0] ??
        shortcut.binding.sourceExtensionLabel ??
        (shortcut.binding.sourceExtensionId ? "Extension" : key));
    const existing = grouped.get(key);
    grouped.set(key, {
      key,
      label: existing && terminal && existing.label !== label ? `${existing.label} / ${label}` : label,
      shortcut: terminal ? shortcut : undefined,
    });
  }
  return [...grouped.values()];
};

export const shortcutHints = (catalog: ResolvedShortcut[], state: KeyboardState) => {
  const hints = new Map<string, string>();
  const sorted = catalog
    .filter((shortcut) => !shortcut.disabled && getKeybindingSteps(shortcut.binding.keybinding).length > 0)
    .sort((a, b) => Number(Boolean(a.binding.layer)) - Number(Boolean(b.binding.layer)));
  for (const shortcut of sorted) {
    if (shortcut.binding.layer && !state.active) continue;
    let hint = getKeybindingSteps(shortcut.binding.keybinding).join(" ");
    if (shortcut.binding.layer) {
      const within = shortcut.keys.slice(0, state.path.length).every((key, index) => key === state.path[index]);
      if (!within) continue;
      const number = actionChoiceNumber(shortcut, catalog);
      hint = [...shortcut.keys.slice(state.path.length), ...(number ? [number] : [])].join(" → ");
    }
    hints.set(getNavigationTargetKey(shortcut.binding.action), hint);
  }
  return hints;
};

export const matchShortcutPath = (catalog: ResolvedShortcut[], path: string[]) => {
  const available = catalog.filter(
    (shortcut) =>
      shortcut.binding.layer &&
      !shortcut.disabled &&
      shortcut.keys.slice(0, path.length).every((key, index) => key === path[index]),
  );
  return {
    candidates: available.some((shortcut) => shortcut.keys.length > path.length)
      ? available
      : available.filter((shortcut) => shortcut.keys.length === path.length),
    complete: available.filter((shortcut) => shortcut.keys.length === path.length),
    hasChildren: available.some((shortcut) => shortcut.keys.length > path.length),
  };
};
