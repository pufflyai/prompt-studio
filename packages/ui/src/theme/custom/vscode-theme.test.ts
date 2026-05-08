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
          "sideBar.background": "#1f201b",
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
      },
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
