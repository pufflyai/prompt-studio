import type { ITheme } from "@xterm/xterm";

/**
 * xterm theme presets aligned with the workbench `bg.inverted` / `fg.inverted`
 * pairings so the terminal blends with the surrounding chrome without the
 * consuming extension touching xterm directly. Consumers can still pass any
 * `ITheme` they like via the `theme` prop.
 */
export type TerminalThemeName = "light" | "dark";

const baseTheme: Partial<ITheme> = {
  cursorAccent: "#000000",
  selectionForeground: undefined,
};

export const lightTerminalTheme: ITheme = {
  ...baseTheme,
  background: "#f4f4f5",
  foreground: "#171717",
  cursor: "#171717",
  selectionBackground: "#d4d4d8",
  black: "#27272a",
  red: "#dc2626",
  green: "#16a34a",
  yellow: "#ca8a04",
  blue: "#2563eb",
  magenta: "#c026d3",
  cyan: "#0891b2",
  white: "#e4e4e7",
  brightBlack: "#52525b",
  brightRed: "#ef4444",
  brightGreen: "#22c55e",
  brightYellow: "#eab308",
  brightBlue: "#3b82f6",
  brightMagenta: "#d946ef",
  brightCyan: "#06b6d4",
  brightWhite: "#fafafa",
};

export const darkTerminalTheme: ITheme = {
  ...baseTheme,
  background: "#0a0a0a",
  foreground: "#fafafa",
  cursor: "#fafafa",
  selectionBackground: "#3f3f46",
  black: "#27272a",
  red: "#f87171",
  green: "#4ade80",
  yellow: "#facc15",
  blue: "#60a5fa",
  magenta: "#e879f9",
  cyan: "#22d3ee",
  white: "#e4e4e7",
  brightBlack: "#52525b",
  brightRed: "#fca5a5",
  brightGreen: "#86efac",
  brightYellow: "#fde047",
  brightBlue: "#93c5fd",
  brightMagenta: "#f0abfc",
  brightCyan: "#67e8f9",
  brightWhite: "#fafafa",
};

export const terminalThemes: Record<TerminalThemeName, ITheme> = {
  light: lightTerminalTheme,
  dark: darkTerminalTheme,
};

export const resolveTerminalTheme = (theme: TerminalThemeName | ITheme | undefined) => {
  if (!theme) return terminalThemes.dark;
  if (typeof theme === "string") return terminalThemes[theme];
  return theme;
};
