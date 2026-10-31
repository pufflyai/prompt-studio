import { describe, expect, test } from "bun:test";
import { contrast } from "./color";
import { createThemeTokens } from "./roles";
import { createMonacoTheme, inferThemeMode, parseVsCodeColorTheme } from "./vscode";

describe("theme asset conversion", () => {
  test("keeps derived surfaces readable at the canvas contrast boundary", () => {
    for (const [background, foreground] of [
      ["#767676", "#FFFFFF"],
      ["#757575", "#000000"],
    ]) {
      const tokens = createThemeTokens("dark", {
        colors: { "editor.background": background, "editor.foreground": foreground },
      });
      for (const role of ["bg.subtle", "bg.hover", "bg.active", "bg.muted", "bg.elevated", "bg.emphasized"]) {
        expect(contrast(tokens[`colors.${role}`], tokens["colors.fg"])).toBeGreaterThanOrEqual(4.5);
        expect(contrast(tokens[`colors.${role}`], tokens["colors.bg"])).toBeGreaterThanOrEqual(1.08);
      }
    }
  });
  test("keeps neutral surfaces readable when component palettes invert their text", () => {
    const tokens = createThemeTokens("dark", {
      colors: {
        "editor.background": "#000000",
        "editor.foreground": "#FFFFFF",
        "editorWidget.background": "#FFFFFF",
        "sideBar.background": "#FFFFFF",
        "list.hoverBackground": "#FFFFFF",
        "list.hoverForeground": "#000000",
      },
    });
    for (const role of ["bg.panel", "bg.subtle", "bg.hover"]) {
      expect(contrast(tokens[`colors.${role}`], tokens["colors.fg"])).toBeGreaterThanOrEqual(4.5);
    }
  });
  test("derives missing menu feedback from the menu surface", () => {
    const tokens = createThemeTokens("dark", {
      colors: {
        "editor.background": "#000000",
        "editor.foreground": "#FFFFFF",
        "menu.background": "#292929",
      },
    });
    expect(contrast(tokens["colors.bg.menu-item.default"], tokens["colors.bg.menu-item.hover"])).toBeGreaterThanOrEqual(
      1.08,
    );
  });
  test("infers brightness from all channels and honors declared modes", () => {
    expect(inferThemeMode({ colors: { "editor.background": "#00FF00" } })).toBe("light");
    expect(inferThemeMode({ colors: { "editor.background": "#FF0000" } })).toBe("light");
    expect(inferThemeMode({ colors: { "editor.background": "#220022" } })).toBe("dark");
    expect(inferThemeMode({ type: "hcLight" })).toBe("light");
    expect(inferThemeMode({ type: "light" }, "dark")).toBe("dark");
  });

  test("expands short syntax colors and preserves empty font-style resets", () => {
    const result = createMonacoTheme("dark", {
      tokenColors: [{ scope: "comment, string", settings: { foreground: "#ABC", fontStyle: "" } }],
    });
    expect(result.rules).toEqual([
      { token: "comment", foreground: "AABBCC", fontStyle: "" },
      { token: "string", foreground: "AABBCC", fontStyle: "" },
    ]);
  });

  test("rejects unsupported or malformed assets with useful messages", () => {
    expect(() => parseVsCodeColorTheme({ tokenColors: "./syntax.tmTheme" })).toThrow("inline array");
    expect(() => parseVsCodeColorTheme({ include: "./base.json" })).toThrow("inline the included");
    expect(() => parseVsCodeColorTheme({ colors: { "editor.background": 12 } })).toThrow("hexadecimal");
    expect(() => parseVsCodeColorTheme({ tokenColors: [null] })).toThrow("syntax rule");
    expect(() => parseVsCodeColorTheme({ tokenColors: [{ settings: { foreground: "invalid" } }] })).toThrow(
      "hexadecimal",
    );
  });

  test("resolves transparent app surfaces against the declared base mode", () => {
    const tokens = createThemeTokens("dark", {
      colors: { "editor.background": "#00000000", "editor.foreground": "#FFFFFF" },
    });
    expect(tokens["colors.bg"]).toBe("#07090E");
    expect(contrast(tokens["colors.bg"], tokens["colors.fg"])).toBeGreaterThanOrEqual(4.5);
  });

  test("keeps explicit app roles authoritative and out of editor colors", () => {
    const theme = {
      colors: { "editor.background": "#222222" },
      pstdio: { colors: { "bg.subtle": "#222222", "border.accent": "#ABCDEF" } },
    };
    expect(createThemeTokens("dark", theme)["colors.bg.subtle"]).toBe("#222222");
    expect(createMonacoTheme("dark", theme).colors).toEqual(theme.colors);
  });

  test("keeps pressed text readable when the pressed surface is transparent", () => {
    const tokens = createThemeTokens("dark", {
      colors: {
        "editor.background": "#000000",
        "button.background": "#FFFFFF",
        "button.foreground": "#000000",
      },
      pstdio: { colors: { "bg.button.primary.pressed": "#FFFFFF00" } },
    });
    expect(contrast(tokens["colors.fg.button.primary.pressed"], "#000000")).toBeGreaterThanOrEqual(4.5);
  });
});
