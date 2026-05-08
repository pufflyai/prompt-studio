import type { ThemePreferenceOption } from "../../utils/apply-theme-preference";
import monokaiTheme from "./monokai.json";

export const monokaiThemePreference = monokaiTheme as ThemePreferenceOption;
export const customThemePreferences = [monokaiThemePreference] satisfies ThemePreferenceOption[];
export type { MonacoThemeData, VsCodeColorTheme } from "./vscode-theme";
export { createMonacoThemeFromVsCodeTheme, createThemePreferenceFromVsCodeTheme } from "./vscode-theme";
