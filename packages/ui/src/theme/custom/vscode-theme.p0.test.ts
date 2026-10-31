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

    expect(preference.id).toBe("lab.monokai");
    expect(preference.mode).toBe("dark");
    expect(preference.tokens).toMatchObject({
      "colors.bg": "#272822",
      "colors.bg.code": "#272822",
      "colors.bg.panel": "#20211C",
      "colors.bg.subtle": "#1F201B",
      "colors.border.accent": "#66d9ef",
      "colors.fg": "#F8F8F2",
      "colors.vscode.activityBar.background": "#191a16",
      "colors.vscode.editor.background": "#272822",
      "colors.vscode.editor.foreground": "#f8f8f2",
      "colors.vscode.editorWidget.background": "#20211c",
      "colors.vscode.focusBorder": "#66d9ef",
      "colors.vscode.panel.background": "#1f201b",
      "colors.vscode.sideBar.background": "#1f201b",
      "colors.vscode.statusBar.background": "#11120f",
    });
    expect(preference.monacoTheme).toMatchObject({
      base: "vs-dark",
      colors: {
        "editor.background": "#272822",
        "editor.foreground": "#f8f8f2",
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
          "list.activeSelectionBackground": "#005A6F",
          "list.hoverBackground": "#004454AA",
          "menu.selectionBackground": "#6272a4",
        },
      },
    });

    expect(preference.tokens).toMatchObject({
      "colors.bg.menu-item.focus": "#6272a4",
      "colors.bg.menu-item.hover": "#6272a4",
      "colors.bg.menu-item.selected": "#6272a4",
      "colors.border": "#44475A",
      "colors.border.subtle": "#44475a",
      "colors.vscode.border": "#44475a",
      "colors.vscode.editor.lineHighlightBackground": "#3a3d4e",
      "colors.vscode.editor.selectionBackground": "#565a6d",
      "colors.vscode.list.activeSelectionBackground": "#005A6F",
      "colors.vscode.list.hoverBackground": "#004454AA",
      "colors.vscode.menu.selectionBackground": "#6272a4",
    });
  });

  test("keeps subtle surfaces apart from the editor background", () => {
    const preference = createThemePreferenceFromVsCodeTheme({
      id: "lab.dracula",
      mode: "dark",
      theme: {
        colors: {
          "editor.background": "#282A36",
          "input.background": "#282A36",
          "sideBar.background": "#21222C",
        },
      },
    });

    expect(preference.tokens).toMatchObject({ "colors.bg": "#282A36", "colors.bg.subtle": "#21222C" });
  });

  test("preserves badge colors without replacing app text and maps git decorations", () => {
    const preference = createThemePreferenceFromVsCodeTheme({
      id: "lab.solarized",
      mode: "light",
      theme: {
        colors: {
          "badge.background": "#eee8d5",
          "badge.foreground": "#657b83",
          "diffEditor.insertedTextBackground": "#85990026",
          "diffEditor.removedTextBackground": "#dc322f26",
          "gitDecoration.addedResourceForeground": "#859900",
          "gitDecoration.deletedResourceForeground": "#dc322f",
        },
      },
    });

    expect(preference.tokens).toMatchObject({
      "colors.bg.error": "#dc322f26",
      "colors.vscode.badge.background": "#eee8d5",
      "colors.bg.success": "#85990026",
      "colors.fg.error": "#dc322f",
      "colors.vscode.badge.foreground": "#657b83",
      "colors.fg.success": "#859900",
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
