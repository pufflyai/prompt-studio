import { getNavigationTargetKey, type KeybindingSequence, type WorkbenchCore } from "../../core";
import type { ResolvedShortcut } from "../../core/controllers/keyboard/shortcut-catalog";
import { shortcutDisplayKeys, shortcutOpeningChord } from "../../core/controllers/keyboard/shortcut-menu";
import { getKeybindingSteps } from "../../core/registries/keybindings/keybinding-registry";

// The palette teaches assigned shortcuts, including keyboard mode's opening chord.
// Input focus and the current keyboard-mode path must not hide those assignments.
export const createPaletteShortcutHints = (
  workbench: WorkbenchCore,
  catalog: ResolvedShortcut[] = workbench.keyboard.catalog(),
) => {
  const hints = new Map<string, KeybindingSequence>();
  const openingChord = shortcutOpeningChord(catalog);
  const leader = catalog.find((shortcut) => shortcut.id === "workbench.keyboard.leader");
  const canOpenKeyboardMode =
    leader && !workbench.keybindings.resolve(leader.binding).disabled && openingChord.length > 0;
  const sorted = catalog
    .filter(
      (shortcut) =>
        !workbench.keybindings.resolve(shortcut.binding).disabled &&
        (!shortcut.binding.layer || canOpenKeyboardMode) &&
        getKeybindingSteps(shortcut.binding.keybinding).length > 0,
    )
    .sort((a, b) => Number(Boolean(b.binding.layer)) - Number(Boolean(a.binding.layer)));
  for (const shortcut of sorted) {
    const keys = shortcutDisplayKeys(shortcut, openingChord, catalog).flatMap(getKeybindingSteps);
    if (keys.length) hints.set(getNavigationTargetKey(shortcut.binding.action), keys.length === 1 ? keys[0]! : keys);
  }
  return hints;
};
