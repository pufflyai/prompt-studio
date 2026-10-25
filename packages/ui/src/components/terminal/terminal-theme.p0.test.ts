import { describe, expect, test } from "bun:test";
import { createTerminalThemeFromPreference, terminalThemes } from "./terminal-theme";

describe("terminal theme preferences", () => {
  test("uses the declared mode for themes whose names do not contain dark", () => {
    expect(createTerminalThemeFromPreference({ id: "themes.monokai", mode: "dark" })).toEqual(terminalThemes.dark);
    expect(createTerminalThemeFromPreference({ id: "themes.dark-paper", mode: "light" })).toEqual(terminalThemes.light);
  });

  test("uses app colors when the theme has no terminal-specific colors", () => {
    expect(
      createTerminalThemeFromPreference({
        id: "themes.monokai",
        mode: "dark",
        tokens: { "colors.bg": "#272822", "colors.fg": "#f8f8f2" },
      }),
    ).toMatchObject({ background: "#272822", foreground: "#f8f8f2", cursor: "#f8f8f2", cursorAccent: "#272822" });
  });

  test("applies terminal surfaces, selection, cursor, and all ANSI colors", () => {
    const ansiNames = ["Black", "Red", "Green", "Yellow", "Blue", "Magenta", "Cyan", "White"];
    const ansiColors = Object.fromEntries(
      ansiNames.flatMap((name, index) => [
        [`${name[0].toLowerCase()}${name.slice(1)}`, `#${index}12233`],
        [`bright${name}`, `#${index}45566`],
      ]),
    );
    const theme = createTerminalThemeFromPreference({
      id: "themes.custom",
      mode: "light",
      tokens: {
        "colors.bg": "#ffffff",
        "colors.fg": "#000000",
        "colors.vscode.terminal.background": "#112233",
        "colors.vscode.terminal.foreground": "#ddeeff",
        "colors.vscode.terminalCursor.foreground": "#abcdef",
        "colors.vscode.terminalCursor.background": "#123456",
        "colors.vscode.terminal.selectionBackground": "#44556688",
        "colors.vscode.terminal.selectionForeground": "#fedcba",
        ...Object.fromEntries(
          Object.entries(ansiColors).map(([name, value]) => [
            `colors.vscode.terminal.ansi${name[0].toUpperCase()}${name.slice(1)}`,
            value,
          ]),
        ),
      },
    });

    expect(theme).toMatchObject({
      background: "#112233",
      foreground: "#ddeeff",
      cursor: "#abcdef",
      cursorAccent: "#123456",
      selectionBackground: "#44556688",
      selectionForeground: "#fedcba",
      ...ansiColors,
    });
  });
});
