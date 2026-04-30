import { themePreferenceCssVariableNames, themePreferenceCssVariables } from "./theme-preference-palettes";

export const themePreferences = ["pstdio-light", "pstdio-dark", "monokai", "dracula"] as const;

export type ThemePreference = (typeof themePreferences)[number];
export type ThemePreferenceMode = "light" | "dark";

const themePreferenceModes = {
  "pstdio-light": "light",
  "pstdio-dark": "dark",
  monokai: "dark",
  dracula: "dark",
} satisfies Record<ThemePreference, ThemePreferenceMode>;

const themeClassNames = themePreferences.map((theme) => `theme-${theme}`);

export const isThemePreference = (value: string | null): value is ThemePreference =>
  themePreferences.includes(value as ThemePreference);

export const getThemePreferenceMode = (theme: ThemePreference) => themePreferenceModes[theme];

export const getThemePreferenceClassNames = (theme: ThemePreference) => [
  getThemePreferenceMode(theme),
  `theme-${theme}`,
];

export const applyThemePreference = (theme: ThemePreference) => {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const body = document.body;
  const mode = getThemePreferenceMode(theme);
  const opposite = mode === "dark" ? "light" : "dark";

  for (const el of [root, body]) {
    if (!el) continue;
    el.classList.remove(opposite);
    el.classList.remove(...themeClassNames);
    el.classList.add(...getThemePreferenceClassNames(theme));
    for (const name of themePreferenceCssVariableNames) {
      el.style.removeProperty(name);
    }
    for (const [name, value] of Object.entries(themePreferenceCssVariables[theme])) {
      el.style.setProperty(name, value);
    }
    el.setAttribute("data-theme", theme);
    el.setAttribute("data-color-mode", mode);
    el.style.colorScheme = mode;
  }
};
