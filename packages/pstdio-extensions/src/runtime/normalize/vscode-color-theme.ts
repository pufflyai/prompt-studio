import type { RuntimeMonacoTheme, RuntimeThemePreference } from "../../types/runtime";

export type VsCodeColorTheme = {
  colors?: Record<string, string>;
  tokenColors?: { scope?: string | string[]; settings?: { foreground?: string; fontStyle?: string } }[];
};

const themeTokenMap = {
  "editor.background": ["colors.bg", "colors.bg.code"],
  "editor.foreground": ["colors.fg"],
  "editor.lineHighlightBackground": ["colors.bg.hover"],
  "editor.selectionBackground": ["colors.bg.active"],
  "editorWidget.background": ["colors.bg.panel"],
  "sideBar.background": ["colors.bg.panel"],
  "panel.background": ["colors.bg.panel"],
  "input.background": ["colors.bg.subtle"],
  "input.foreground": ["colors.fg"],
  "input.border": ["colors.border"],
  "dropdown.background": ["colors.bg.panel"],
  "menu.background": ["colors.bg.panel", "colors.bg.menu-item.default"],
  "menu.foreground": ["colors.fg.menu-item.default"],
  "menu.selectionBackground": [
    "colors.bg.menu-item.hover",
    "colors.bg.menu-item.focus",
    "colors.bg.menu-item.selected",
  ],
  "list.hoverBackground": ["colors.bg.menu-item.hover", "colors.bg.menu-item.focus"],
  "list.focusBackground": ["colors.bg.menu-item.focus"],
  "list.inactiveSelectionBackground": ["colors.bg.menu-item.selected"],
  "list.activeSelectionBackground": ["colors.bg.menu-item.selected"],
  "badge.background": ["colors.bg.muted"],
  "badge.foreground": ["colors.fg.muted"],
  "button.background": ["colors.bg.button.primary.default", "colors.bg.accent-primary.default"],
  "button.hoverBackground": ["colors.bg.button.primary.hover", "colors.bg.accent-primary.hover"],
  "button.foreground": ["colors.fg.button.primary.default"],
  "diffEditor.insertedTextBackground": ["colors.bg.success"],
  "diffEditor.removedTextBackground": ["colors.bg.error"],
  focusBorder: ["colors.border.accent"],
  foreground: ["colors.fg"],
  "gitDecoration.addedResourceForeground": ["colors.fg.success"],
  "gitDecoration.deletedResourceForeground": ["colors.fg.error"],
  descriptionForeground: ["colors.fg.muted"],
  disabledForeground: ["colors.fg.subtle"],
  border: ["colors.border", "colors.border.subtle"],
} satisfies Record<string, string[]>;

const getVsCodeTokenPath = (token: string) => `colors.vscode.${token}`;

const stripHash = (value: string) => value.replace(/^#/, "");

export const createThemePreference = (
  id: string,
  mode: "light" | "dark",
  theme: VsCodeColorTheme,
): RuntimeThemePreference => {
  const tokens: Record<string, string> = {};
  const colors = theme.colors ?? {};

  for (const [vsCodeToken, value] of Object.entries(colors)) {
    tokens[getVsCodeTokenPath(vsCodeToken)] = value;
  }

  for (const [vsCodeToken, tokenPaths] of Object.entries(themeTokenMap)) {
    const value = colors[vsCodeToken];
    if (!value) continue;
    for (const tokenPath of tokenPaths) tokens[tokenPath] = value;
  }

  return { id, mode, tokens };
};

export const createMonacoTheme = (mode: "light" | "dark", theme: VsCodeColorTheme): RuntimeMonacoTheme => ({
  base: mode === "dark" ? "vs-dark" : "vs",
  inherit: true,
  rules: (theme.tokenColors ?? []).flatMap((tokenColor) => {
    const scopes = tokenColor.scope ? [tokenColor.scope].flat() : [];
    return scopes.map((scope) => ({
      token: scope,
      ...(tokenColor.settings?.foreground ? { foreground: stripHash(tokenColor.settings.foreground) } : {}),
      ...(tokenColor.settings?.fontStyle ? { fontStyle: tokenColor.settings.fontStyle } : {}),
    }));
  }),
  colors: theme.colors ?? {},
});

export const inferMode = (theme: VsCodeColorTheme, fallback: unknown): "light" | "dark" => {
  if (fallback === "light" || fallback === "dark") return fallback;
  const background = theme.colors?.["editor.background"] ?? "";
  return background.toLowerCase() < "#808080" ? "dark" : "light";
};
