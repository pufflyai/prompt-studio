import { customThemePreferences, defaultThemePreferences, type ThemePreferenceOption } from "@pstdio/ui";

export const dashboardThemePreferences = [
  ...defaultThemePreferences,
  ...customThemePreferences,
] satisfies ThemePreferenceOption[];
