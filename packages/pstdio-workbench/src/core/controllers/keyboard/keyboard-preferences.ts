import {
  readShortcutPreferences,
  SHORTCUT_PREFERENCE_KEY,
  type ShortcutAssignment,
} from "../../registries/keybindings/shortcut-preferences";
import type { WorkbenchCore } from "../../workbench-core-types";
import { validateShortcutAlias, validateShortcutAssignment } from "./shortcut-validation";
export const createKeyboardPreferences = (getCore: () => WorkbenchCore, refresh: () => void) => ({
  getAssignment(id: string) {
    return readShortcutPreferences(getCore().preferences).overrides[id];
  },
  async setAssignment(id: string, assignment: ShortcutAssignment) {
    const core = getCore();
    const config = readShortcutPreferences(core.preferences);
    validateShortcutAssignment(core, id, assignment);
    await core.preferences.setValue(
      SHORTCUT_PREFERENCE_KEY,
      { ...config, overrides: { ...config.overrides, [id]: assignment } },
      { scope: "user" },
    );
    refresh();
  },
  async resetAssignment(id: string) {
    const core = getCore();
    const config = readShortcutPreferences(core.preferences);
    const overrides = { ...config.overrides };
    delete overrides[id];
    await core.preferences.setValue(SHORTCUT_PREFERENCE_KEY, { ...config, overrides }, { scope: "user" });
    refresh();
  },
  /** @deprecated Assign the action to a shared layer instead. */
  getAlias(extensionId: string) {
    return readShortcutPreferences(getCore().preferences).aliases[extensionId];
  },
  /** @deprecated Assign the action to a shared layer instead. */
  async setAlias(extensionId: string, alias: string) {
    const core = getCore();
    const config = readShortcutPreferences(core.preferences);
    const normalized = alias.trim().toUpperCase();
    validateShortcutAlias(config.aliases, extensionId, normalized);
    const aliases = { ...config.aliases };
    if (normalized) aliases[extensionId] = normalized;
    else delete aliases[extensionId];
    await core.preferences.setValue(SHORTCUT_PREFERENCE_KEY, { ...config, aliases }, { scope: "user" });
    refresh();
  },
});
