import type { PaletteEntry, ThemePreference, ThemePreferenceOption } from "@pstdio/ui";
import { WorkbenchIcon } from "../shared/icon";

const THEME_MODE_ID = "theme";

export interface WorkbenchThemePaletteEntry extends PaletteEntry {
  themePreference: ThemePreference;
  mode: typeof THEME_MODE_ID;
}

const getThemeIconName = (preference: ThemePreference) => {
  if (preference === "pstdio-light") return "Sun";
  if (preference === "pstdio-dark") return "Moon";
  return "Palette";
};

const getThemePreferenceLabel = (themePreference: ThemePreferenceOption) => themePreference.title ?? themePreference.id;

export const getThemePreferenceEntryIndex = (
  themePreference: ThemePreference,
  themePreferences: readonly ThemePreferenceOption[],
) => {
  const index = themePreferences.findIndex((preference) => preference.id === themePreference);

  return Math.max(index, 0);
};

export const createWorkbenchThemePreferencePaletteEntries = (input: {
  themePreference: ThemePreference;
  themePreferences: readonly ThemePreferenceOption[];
  setThemePreference: (themePreference: ThemePreference) => void;
  onClose: () => void;
}) => {
  const { onClose, setThemePreference, themePreference, themePreferences } = input;

  return themePreferences.map((preference): WorkbenchThemePaletteEntry => {
    const label = getThemePreferenceLabel(preference);

    return {
      id: `theme:${preference.id}`,
      themePreference: preference.id,
      mode: THEME_MODE_ID,
      label,
      searchText: `theme color appearance ${preference.id} ${label}`,
      group: "Themes",
      icon: <WorkbenchIcon name={getThemeIconName(preference.id)} />,
      isSelected: preference.id === themePreference,
      onActivate: () => {
        setThemePreference(preference.id);
        onClose();
      },
    };
  });
};
