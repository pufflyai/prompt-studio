import { describe, expect, test } from "bun:test";
import { createMonacoThemeFromVsCodeTheme, createThemePreferenceFromVsCodeTheme } from "./vscode-theme";

describe("VS Code theme conversion", () => {
  test("maps editor colors into app tokens", () => {
    const preference = createThemePreferenceFromVsCodeTheme({
      id: "lab.monokai",
      mode: "dark",
      theme: {
        colors: {
          "editor.background": "#272822",
          "editor.foreground": "#f8f8f2",
          "editorWidget.background": "#20211c",
          "panel.background": "#1f201b",
          "sideBar.background": "#1f201b",
          "activityBar.background": "#191a16",
          "statusBar.background": "#11120f",
          focusBorder: "#66d9ef",
        },
      },
    });

    expect(preference).toEqual({
      id: "lab.monokai",
      mode: "dark",
      tokens: {
        "colors.bg": "#272822",
        "colors.bg.code": "#272822",
        "colors.bg.panel": "#1f201b",
        "colors.border.accent": "#66d9ef",
        "colors.fg": "#f8f8f2",
        "colors.vscode.activityBar.background": "#191a16",
        "colors.vscode.editor.background": "#272822",
        "colors.vscode.editor.foreground": "#f8f8f2",
        "colors.vscode.editorWidget.background": "#20211c",
        "colors.vscode.focusBorder": "#66d9ef",
        "colors.vscode.panel.background": "#1f201b",
        "colors.vscode.sideBar.background": "#1f201b",
        "colors.vscode.statusBar.background": "#11120f",
      },
    });
  });

  test("maps shell interaction colors into app tokens", () => {
    const preference = createThemePreferenceFromVsCodeTheme({
      id: "lab.dracula",
      mode: "dark",
      theme: {
        colors: {
          border: "#44475a",
          "editor.lineHighlightBackground": "#3a3d4e",
          "editor.selectionBackground": "#565a6d",
          "menu.selectionBackground": "#6272a4",
        },
      },
    });

    expect(preference.tokens).toMatchObject({
      "colors.bg.active": "#565a6d",
      "colors.bg.hover": "#3a3d4e",
      "colors.bg.menu-item.focus": "#6272a4",
      "colors.bg.menu-item.hover": "#6272a4",
      "colors.bg.menu-item.selected": "#6272a4",
      "colors.border": "#44475a",
      "colors.border.muted": "#44475a",
      "colors.border.subtle": "#44475a",
    });
  });

  test("creates a Monaco theme from VS Code color themes", () => {
    const monacoTheme = createMonacoThemeFromVsCodeTheme({
      mode: "light",
      theme: {
        tokenColors: [{ scope: "comment", settings: { foreground: "#75715e", fontStyle: "italic" } }],
        colors: {
          "editor.background": "#ffffff",
          "editor.foreground": "#111111",
        },
      },
    });

    expect(monacoTheme).toEqual({
      base: "vs",
      inherit: true,
      rules: [{ token: "comment", foreground: "75715e", fontStyle: "italic" }],
      colors: {
        "editor.background": "#ffffff",
        "editor.foreground": "#111111",
      },
    });
  });
});
