import {
  createThemePreferenceFromVsCodeTheme,
  type ThemePreferenceMode,
  type ThemePreferenceOption,
  type VsCodeColorTheme,
} from "@pstdio/ui";

// A color theme an extension would ship as VS Code-compatible JSON. The workbench
// reads tokens such as `editor.background` and `sideBar.background` to paint its
// chrome, so a contributed theme restyles the whole shell, not just content.
export interface ExtensionColorTheme {
  id: string;
  title: string;
  mode: ThemePreferenceMode;
  theme: VsCodeColorTheme;
}

const midnight: VsCodeColorTheme = {
  colors: {
    foreground: "#e6e8f0",
    descriptionForeground: "#9aa0b4",
    disabledForeground: "#5b6076",
    focusBorder: "#7c5cff",
    border: "#2a2e42",
    "editor.background": "#11131c",
    "editor.foreground": "#e6e8f0",
    "activityBar.background": "#0c0e16",
    "sideBar.background": "#171a26",
    "panel.background": "#171a26",
    "editorWidget.background": "#1d2030",
    "statusBar.background": "#0c0e16",
    "input.background": "#1d2030",
    "input.foreground": "#e6e8f0",
    "input.border": "#2a2e42",
    "dropdown.background": "#1d2030",
    "menu.background": "#1d2030",
    "menu.foreground": "#e6e8f0",
    "menu.selectionBackground": "#2a2e42",
    "button.background": "#7c5cff",
    "button.hoverBackground": "#9579ff",
    "button.foreground": "#0c0e16",
  },
};

const sandstone: VsCodeColorTheme = {
  colors: {
    foreground: "#3a3326",
    descriptionForeground: "#7a7058",
    disabledForeground: "#a89e86",
    focusBorder: "#c2691f",
    border: "#e6dcc8",
    "editor.background": "#fbf7f0",
    "editor.foreground": "#3a3326",
    "activityBar.background": "#f1e9d8",
    "sideBar.background": "#f5efe2",
    "panel.background": "#f5efe2",
    "editorWidget.background": "#ffffff",
    "statusBar.background": "#f1e9d8",
    "input.background": "#ffffff",
    "input.foreground": "#3a3326",
    "input.border": "#e6dcc8",
    "dropdown.background": "#ffffff",
    "menu.background": "#ffffff",
    "menu.foreground": "#3a3326",
    "menu.selectionBackground": "#f1e9d8",
    "button.background": "#c2691f",
    "button.hoverBackground": "#d97e2f",
    "button.foreground": "#fbf7f0",
  },
};

export const extensionColorThemes: ExtensionColorTheme[] = [
  { id: "extension-midnight", title: "Midnight (Extension)", mode: "dark", theme: midnight },
  { id: "extension-sandstone", title: "Sandstone (Extension)", mode: "light", theme: sandstone },
];

// The theme preferences the Theme Pack extension declares as its `themes`
// contribution. The extension host merges these with the built-in workbench
// themes while the extension is enabled.
export const extensionThemePreferences: ThemePreferenceOption[] = extensionColorThemes.map((entry) => ({
  ...createThemePreferenceFromVsCodeTheme({ id: entry.id, mode: entry.mode, theme: entry.theme }),
  title: entry.title,
}));
