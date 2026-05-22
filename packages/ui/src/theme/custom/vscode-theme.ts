import type { ThemePreferenceMode, ThemePreferenceOption } from "../../utils/apply-theme-preference";

export interface VsCodeColorTheme {
  colors?: Record<string, string>;
  tokenColors?: VsCodeTokenColor[];
}

interface VsCodeTokenColor {
  scope?: string | string[];
  settings?: {
    foreground?: string;
    fontStyle?: string;
  };
}

export interface MonacoThemeData {
  base: "vs" | "vs-dark";
  inherit: true;
  rules: { token: string; foreground?: string; fontStyle?: string }[];
  colors: Record<string, string>;
}

const tokenMap = {
  "editor.background": ["colors.bg", "colors.bg.code"],
  "editor.foreground": ["colors.fg"],
  "editorWidget.background": ["colors.bg.panel"],
  "sideBar.background": ["colors.bg.panel"],
  "panel.background": ["colors.bg.panel"],
  "input.background": ["colors.bg.subtle"],
  "input.foreground": ["colors.fg"],
  "input.border": ["colors.border"],
  "dropdown.background": ["colors.bg.panel"],
  "menu.background": ["colors.bg.panel", "colors.bg.menu-item.default"],
  "menu.foreground": ["colors.fg.menu-item.default"],
  "menu.selectionBackground": ["colors.bg.menu-item.selected"],
  "button.background": ["colors.bg.button.primary.default", "colors.bg.accent-primary.default"],
  "button.hoverBackground": ["colors.bg.button.primary.hover", "colors.bg.accent-primary.hover"],
  "button.foreground": ["colors.fg.button.primary.default"],
  focusBorder: ["colors.border.accent"],
  foreground: ["colors.fg"],
  descriptionForeground: ["colors.fg.muted"],
  disabledForeground: ["colors.fg.subtle"],
  border: ["colors.border"],
} satisfies Record<string, string[]>;

const getVsCodeTokenPath = (token: string) => `colors.vscode.${token}`;

const stripHash = (value: string) => value.replace(/^#/, "");

export const createThemePreferenceFromVsCodeTheme = (input: {
  id: string;
  mode: ThemePreferenceMode;
  theme: VsCodeColorTheme;
}): ThemePreferenceOption => {
  const tokens: Record<string, string> = {};
  const colors = input.theme.colors ?? {};

  for (const [vsCodeToken, value] of Object.entries(colors)) {
    tokens[getVsCodeTokenPath(vsCodeToken)] = value;
  }

  for (const [vsCodeToken, tokenPaths] of Object.entries(tokenMap)) {
    const value = colors[vsCodeToken];
    if (!value) continue;
    for (const tokenPath of tokenPaths) tokens[tokenPath] = value;
  }

  return { id: input.id, mode: input.mode, tokens };
};

export const createMonacoThemeFromVsCodeTheme = (input: {
  mode: ThemePreferenceMode;
  theme: VsCodeColorTheme;
}): MonacoThemeData => {
  const rules = (input.theme.tokenColors ?? []).flatMap((tokenColor) => {
    const scopes = Array.isArray(tokenColor.scope) ? tokenColor.scope : tokenColor.scope ? [tokenColor.scope] : [];
    return scopes.map((scope) => ({
      token: scope,
      ...(tokenColor.settings?.foreground ? { foreground: stripHash(tokenColor.settings.foreground) } : {}),
      ...(tokenColor.settings?.fontStyle ? { fontStyle: tokenColor.settings.fontStyle } : {}),
    }));
  });

  return {
    base: input.mode === "dark" ? "vs-dark" : "vs",
    inherit: true,
    rules,
    colors: input.theme.colors ?? {},
  };
};
