import type { ITheme } from "@xterm/xterm";
import psTheme from "../../theme/theme";
import type { ThemePreferenceOption } from "../../utils/apply-theme-preference";

/**
 * xterm theme presets built from the `colors.terminal.<preset>` tokens so the
 * terminal blends with the surrounding chrome without the consuming extension
 * touching xterm directly. Consumers can still pass any `ITheme` they like via
 * the `theme` prop.
 */
export type TerminalThemeName = "light" | "dark";

const createTerminalTheme = (preset: TerminalThemeName) => {
  // xterm parses color strings itself, so resolve raw token values instead of CSS variables.
  const color = (name: string) => psTheme.token(`colors.terminal.${preset}.${name}`);

  return {
    background: color("background"),
    foreground: color("foreground"),
    cursor: color("cursor"),
    cursorAccent: color("cursorAccent"),
    selectionBackground: color("selectionBackground"),
    selectionForeground: undefined,
    black: color("black"),
    red: color("red"),
    green: color("green"),
    yellow: color("yellow"),
    blue: color("blue"),
    magenta: color("magenta"),
    cyan: color("cyan"),
    white: color("white"),
    brightBlack: color("brightBlack"),
    brightRed: color("brightRed"),
    brightGreen: color("brightGreen"),
    brightYellow: color("brightYellow"),
    brightBlue: color("brightBlue"),
    brightMagenta: color("brightMagenta"),
    brightCyan: color("brightCyan"),
    brightWhite: color("brightWhite"),
  };
};

export const lightTerminalTheme: ITheme = createTerminalTheme("light");

export const darkTerminalTheme: ITheme = createTerminalTheme("dark");

export const terminalThemes: Record<TerminalThemeName, ITheme> = {
  light: lightTerminalTheme,
  dark: darkTerminalTheme,
};

/** Resolve concrete xterm colors from the theme's mode and contributed VS Code tokens. */
export const createTerminalThemeFromPreference = (preference: ThemePreferenceOption) => {
  const tokens = preference.tokens ?? {};
  const theme = { ...terminalThemes[preference.mode] };
  const foreground = tokens["colors.vscode.terminal.foreground"] ?? tokens["colors.fg"];
  const background = tokens["colors.vscode.terminal.background"] ?? tokens["colors.bg"];
  const colors = {
    background,
    foreground,
    cursor: tokens["colors.vscode.terminalCursor.foreground"] ?? foreground,
    cursorAccent: tokens["colors.vscode.terminalCursor.background"] ?? background,
    selectionBackground: tokens["colors.vscode.terminal.selectionBackground"],
    selectionForeground: tokens["colors.vscode.terminal.selectionForeground"],
  };
  for (const name of Object.keys(colors) as (keyof typeof colors)[]) {
    const value = colors[name];
    if (value) theme[name] = value;
  }
  for (const name of ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"] as const) {
    const ansiName = `${name[0].toUpperCase()}${name.slice(1)}` as Capitalize<typeof name>;
    const normal = tokens[`colors.vscode.terminal.ansi${ansiName}`];
    const bright = tokens[`colors.vscode.terminal.ansiBright${ansiName}`];
    if (normal) theme[name] = normal;
    if (bright) theme[`bright${ansiName}`] = bright;
  }
  return theme;
};

export const resolveTerminalTheme = (theme: TerminalThemeName | ITheme | undefined) => {
  if (!theme) return terminalThemes.dark;
  if (typeof theme === "string") return terminalThemes[theme];
  return theme;
};
