import type { PreferenceRegistry } from "../preferences/preference-registry";

export const SHORTCUT_PREFERENCE_KEY = "workbench.keyboard";
export const DEFAULT_SHORTCUT_LEADER = "Alt+Shift+Space";
export const shortcutLayers = {
  view: "V",
  go: "G",
  create: "C",
  current: "A",
  settings: "S",
} as const;
/** `extensions` and `help` are deprecated layers. */
export type ShortcutLayer = keyof typeof shortcutLayers | "extensions" | "help";
/** Legacy extension and help bindings join shared actions until their author chooses a specific group. */
export const sharedShortcutLayer = (layer: ShortcutLayer) =>
  layer === "extensions" || layer === "help" ? "current" : layer;
export interface ShortcutAssignment {
  keybinding?: string;
  disabled?: boolean;
  layer?: ShortcutLayer | "direct";
}
export interface ShortcutPreferences {
  overrides: Record<string, ShortcutAssignment>;
  /** @deprecated Choose a shared action layer instead of an extension alias. */
  aliases: Record<string, string>;
}
export const readShortcutPreferences = (preferences?: PreferenceRegistry): ShortcutPreferences => {
  const value = preferences?.getValue(SHORTCUT_PREFERENCE_KEY) as Partial<ShortcutPreferences> | undefined;
  return { overrides: value?.overrides ?? {}, aliases: value?.aliases ?? {} };
};
