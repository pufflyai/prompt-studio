import type { PreferenceRegistry } from "../preferences/preference-registry";

export const SHORTCUT_PREFERENCE_KEY = "workbench.keyboard";
export const DEFAULT_SHORTCUT_LEADER = "Alt+Shift+Space";
export const shortcutLayers = {
  view: "V",
  go: "G",
  create: "C",
  current: "A",
  extensions: "E",
  settings: "S",
  help: "H",
} as const;
export type ShortcutLayer = keyof typeof shortcutLayers;
export interface ShortcutAssignment {
  keybinding?: string;
  disabled?: boolean;
  layer?: ShortcutLayer | "direct";
}
export interface ShortcutPreferences {
  overrides: Record<string, ShortcutAssignment>;
  aliases: Record<string, string>;
}
export const readShortcutPreferences = (preferences?: PreferenceRegistry): ShortcutPreferences => {
  const value = preferences?.getValue(SHORTCUT_PREFERENCE_KEY) as Partial<ShortcutPreferences> | undefined;
  return { overrides: value?.overrides ?? {}, aliases: value?.aliases ?? {} };
};
