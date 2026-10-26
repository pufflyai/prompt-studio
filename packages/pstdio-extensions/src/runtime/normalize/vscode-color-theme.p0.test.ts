import { describe, expect, test } from "bun:test";
import { createMonacoTheme, createThemePreference } from "./vscode-color-theme";

describe("contributed application theme colors", () => {
  test("applies application colors after the VS Code mapping", () => {
    const preference = createThemePreference("custom", "dark", {
      colors: { border: "#444444", "button.background": "#BD93F9" },
      pstdio: {
        colors: {
          "border.subtle": "#343746",
          "border.accent-light": "#BD93F9",
          "bg.button.primary.pressed": "#A579E3",
        },
      },
    });

    expect(preference.tokens).toMatchObject({
      "colors.border": "#444444",
      "colors.border.subtle": "#343746",
      "colors.border.accent-light": "#BD93F9",
      "colors.bg.button.primary.default": "#BD93F9",
      "colors.bg.button.primary.pressed": "#A579E3",
    });
  });

  test("keeps application colors out of Monaco's VS Code color registry", () => {
    const colors = { "editor.background": "#282A36" };
    expect(
      createMonacoTheme("dark", {
        colors,
        pstdio: { colors: { "border.subtle": "#343746" } },
      }).colors,
    ).toEqual(colors);
  });

  test("imports plain VS Code themes without application overrides", () => {
    expect(
      createThemePreference("external", "light", {
        colors: { border: "#CCCCCC", "button.background": "#196B9B" },
      }).tokens,
    ).toMatchObject({
      "colors.border": "#CCCCCC",
      "colors.border.subtle": "#CCCCCC",
      "colors.bg.button.primary.default": "#196B9B",
    });
  });
});
