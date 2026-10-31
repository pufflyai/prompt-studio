import {
  createMonacoTheme,
  createThemeTokens,
  type MonacoThemeData,
  parseVsCodeColorTheme,
  type VsCodeColorTheme,
} from "pstdio-theme";
import type { ThemePreferenceMode, ThemePreferenceOption } from "../../utils/apply-theme-preference";

export type { MonacoThemeData, VsCodeColorTheme };

export const createMonacoThemeFromVsCodeTheme = (input: { mode: ThemePreferenceMode; theme: VsCodeColorTheme }) =>
  createMonacoTheme(input.mode, parseVsCodeColorTheme(input.theme));

export const createThemePreferenceFromVsCodeTheme = (input: {
  id: string;
  mode: ThemePreferenceMode;
  theme: VsCodeColorTheme;
}) => {
  const theme = parseVsCodeColorTheme(input.theme);
  return {
    id: input.id,
    mode: input.mode,
    tokens: createThemeTokens(input.mode, theme),
    monacoTheme: createMonacoTheme(input.mode, theme),
  } satisfies ThemePreferenceOption;
};
