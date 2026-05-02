import type { ThemePreferenceOption } from "../../utils/apply-theme-preference";
import monokaiTheme from "./monokai.json";

export const monokaiThemePreference = monokaiTheme as ThemePreferenceOption;
export const customThemePreferences = [monokaiThemePreference] satisfies ThemePreferenceOption[];
