import { createThemeTokens, type ThemeMode, type VsCodeColorTheme } from "pstdio-theme";

export { createMonacoTheme, inferThemeMode as inferMode, type VsCodeColorTheme } from "pstdio-theme";

export const createThemePreference = (id: string, mode: ThemeMode, theme: VsCodeColorTheme) => ({
  id,
  mode,
  tokens: createThemeTokens(mode, theme),
});
