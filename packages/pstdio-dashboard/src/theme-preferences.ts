import { defaultThemePreferences, type ThemePreferenceOption } from "@pstdio/ui";

export const dashboardThemePreferences = defaultThemePreferences;

export const mergeDashboardThemePreferences = (extensionThemePreferences: readonly ThemePreferenceOption[] = []) => {
  const byId = new Map<string, ThemePreferenceOption>();

  for (const preference of [...dashboardThemePreferences, ...extensionThemePreferences]) {
    byId.set(preference.id, preference);
  }

  return [...byId.values()];
};
