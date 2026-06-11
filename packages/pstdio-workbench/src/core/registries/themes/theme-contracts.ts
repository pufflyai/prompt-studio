/**
 * Core-owned contract for theme registrations. Structurally identical to
 * @pstdio/ui's ThemePreferenceOption; the React layer bridges the two so core
 * does not depend on UI package ownership.
 */
export type ThemePreference = string;
export type ThemePreferenceMode = "light" | "dark";
export type ThemePreferenceTokens = Record<string, string>;

export interface ThemePreferenceOption {
  id: ThemePreference;
  title?: string;
  mode: ThemePreferenceMode;
  tokens?: ThemePreferenceTokens;
  monacoTheme?: unknown;
}
