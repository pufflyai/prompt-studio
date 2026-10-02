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

export const defaultThemePreferences = [
  { id: "pstdio-light", mode: "light" },
  { id: "pstdio-dark", mode: "dark" },
] satisfies ThemePreferenceOption[];

export const isThemePreference = (
  value: string | null,
  themePreferences: readonly ThemePreferenceOption[] = defaultThemePreferences,
): value is ThemePreference => typeof value === "string" && themePreferences.some((theme) => theme.id === value);

export const getThemePreferenceMode = (
  theme: ThemePreference,
  themePreferences: readonly ThemePreferenceOption[] = defaultThemePreferences,
) => themePreferences.find((preference) => preference.id === theme)?.mode ?? "light";

export const getThemePreferenceClassName = (theme: ThemePreference) => `theme-${theme}`;

export const getThemePreferenceClassNames = (
  theme: ThemePreference,
  mode: ThemePreferenceMode = getThemePreferenceMode(theme),
) => [mode, getThemePreferenceClassName(theme)];

const THEME_TOKEN_PATHS_ATTRIBUTE = "data-pstdio-theme-token-paths";

const getThemePreferenceCssVariableName = (tokenPath: string) => `--chakra-${tokenPath.replaceAll(".", "-")}`;

// Pressed and selected controls use `bg.active`. Its default is tuned for the default surface, so a
// theme that replaces the surface without its own pressed color can make pressed controls look
// unpressed. Mix the text color into the surface instead, at about the contrast the default themes
// use. Hover keeps its default: it must stay visible on every panel surface, not only this one.
const surfaceActiveColor = `color-mix(in srgb, var(${getThemePreferenceCssVariableName("colors.fg")}) 12%, var(${getThemePreferenceCssVariableName("colors.bg")}))`;

const resolveThemeTokens = (tokens: ThemePreferenceTokens) =>
  tokens["colors.bg"] ? { "colors.bg.active": surfaceActiveColor, ...tokens } : tokens;

const removeThemeTokens = (el: HTMLElement, theme?: ThemePreferenceOption) => {
  if (!theme?.tokens) return;

  for (const tokenPath of Object.keys(theme.tokens)) {
    el.style.removeProperty(getThemePreferenceCssVariableName(tokenPath));
  }
};

const removeTrackedThemeTokens = (el: HTMLElement) => {
  const tokenPaths = el.getAttribute(THEME_TOKEN_PATHS_ATTRIBUTE)?.split("\n").filter(Boolean) ?? [];

  for (const tokenPath of tokenPaths) {
    el.style.removeProperty(getThemePreferenceCssVariableName(tokenPath));
  }

  el.setAttribute(THEME_TOKEN_PATHS_ATTRIBUTE, "");
};

const applyThemeTokens = (el: HTMLElement, theme: ThemePreferenceOption) => {
  if (!theme.tokens) {
    el.setAttribute(THEME_TOKEN_PATHS_ATTRIBUTE, "");
    return;
  }

  const tokens = resolveThemeTokens(theme.tokens);
  for (const [tokenPath, value] of Object.entries(tokens)) {
    el.style.setProperty(getThemePreferenceCssVariableName(tokenPath), value);
  }
  el.setAttribute(THEME_TOKEN_PATHS_ATTRIBUTE, Object.keys(tokens).join("\n"));
};

export const applyThemePreference = (
  theme: ThemePreference,
  themePreferences: readonly ThemePreferenceOption[] = defaultThemePreferences,
) => {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const body = document.body;
  const preference = themePreferences.find((option) => option.id === theme) ?? { id: theme, mode: "light" };
  const mode = getThemePreferenceMode(theme, themePreferences);

  for (const el of [root, body]) {
    if (!el) continue;
    const previousTheme = el.getAttribute("data-theme");
    const previousPreference = themePreferences.find((option) => option.id === previousTheme);

    el.classList.remove("light", "dark");
    if (previousTheme) {
      el.classList.remove(getThemePreferenceClassName(previousTheme));
    }
    removeTrackedThemeTokens(el);
    removeThemeTokens(el, previousPreference);
    applyThemeTokens(el, preference);
    el.classList.add(...getThemePreferenceClassNames(theme, mode));
    el.setAttribute("data-theme", theme);
    el.setAttribute("data-color-mode", mode);
    el.style.colorScheme = mode;
  }
};
