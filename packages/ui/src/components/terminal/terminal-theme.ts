import type { ITheme } from "@xterm/xterm";
import psTheme from "../../theme/theme";

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

export const resolveTerminalTheme = (theme: TerminalThemeName | ITheme | undefined) => {
  if (!theme) return terminalThemes.dark;
  if (typeof theme === "string") return terminalThemes[theme];
  return theme;
};
