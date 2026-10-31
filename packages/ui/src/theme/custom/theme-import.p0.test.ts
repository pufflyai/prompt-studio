import { describe, expect, test } from "bun:test";
import { contrast } from "pstdio-theme";
import { createThemePreferenceFromVsCodeTheme as convert } from "./vscode-theme";

const preference = (theme: Parameters<typeof convert>[0]["theme"]) => convert({ id: "test", mode: "dark", theme });

describe("imported theme roles", () => {
  test("keeps hover visible on both canvas and panels", () => {
    const tokens = preference({ colors: { "editor.background": "#000000", "editorWidget.background": "#292929" } })
      .tokens!;
    expect(contrast(tokens["colors.bg.hover"], tokens["colors.bg.panel"])).toBeGreaterThanOrEqual(1.08);
  });

  test("does not use editor text selection as a neutral control background", () => {
    const tokens = preference({
      colors: {
        "editor.background": "#000000",
        "editor.foreground": "#FFFFFF",
        "editor.selectionBackground": "#FFFFFF",
      },
    }).tokens!;
    expect(contrast(tokens["colors.bg.active"], tokens["colors.fg"])).toBeGreaterThanOrEqual(4.5);
  });
  test("uses application overrides in the public importer", () => {
    const theme = { colors: { "editor.background": "#282A36" }, pstdio: { colors: { "bg.subtle": "#343746" } } };
    expect(preference(theme).tokens?.["colors.bg.subtle"]).toBe("#343746");
  });

  test("separates flat and absent sidebar surfaces", () => {
    for (const sidebar of [undefined, "#282A36", "#282A3600"]) {
      const colors: Record<string, string> = { "editor.background": "#282A36", "editor.foreground": "#FFFFFF" };
      if (sidebar) colors["sideBar.background"] = sidebar;
      const tokens = preference({ colors }).tokens!;
      expect(tokens["colors.bg.subtle"]).toBeDefined();
      expect(tokens["colors.bg.subtle"]).not.toBe(tokens["colors.bg"]);
      expect(tokens["colors.bg.subtle"]).not.toBe("#282A3600");
    }
  });

  test("keeps component foregrounds from replacing app foregrounds", () => {
    const tokens = preference({
      colors: {
        "editor.foreground": "#FFFFFF",
        "input.foreground": "#111111",
        "badge.foreground": "#000000",
        descriptionForeground: "#CCCCCC",
      },
    }).tokens!;
    expect(tokens["colors.fg"]).toBe("#FFFFFF");
    expect(tokens["colors.fg.muted"]).toBe("#CCCCCC");
  });

  test("pairs menu selection backgrounds and foregrounds", () => {
    const tokens = preference({
      colors: {
        "menu.selectionBackground": "#EEEEEE",
        "menu.selectionForeground": "#111111",
        "list.activeSelectionBackground": "#333333",
        "list.activeSelectionForeground": "#FFFFFF",
      },
    }).tokens!;
    expect(tokens["colors.bg.menu-item.selected"]).toBe("#EEEEEE");
    expect(tokens["colors.fg.menu-item.selected"]).toBe("#111111");
  });

  test("does not borrow list text for a different menu highlight", () => {
    const tokens = preference({
      colors: {
        "editor.background": "#000000",
        "editor.foreground": "#FFFFFF",
        "menu.selectionBackground": "#FFFFFF",
        "list.activeSelectionBackground": "#333333",
        "list.activeSelectionForeground": "#FFFFFF",
      },
    }).tokens!;
    expect(
      contrast(tokens["colors.bg.menu-item.selected"], tokens["colors.fg.menu-item.selected"]),
    ).toBeGreaterThanOrEqual(4.5);
  });

  test("derives primary interaction states inside the imported palette", () => {
    const tokens = preference({ colors: { "editor.background": "#222222", "button.background": "#8755CC" } }).tokens!;
    expect(tokens["colors.bg.button.primary.hover"]).toBeDefined();
    expect(tokens["colors.bg.button.primary.pressed"]).toBeDefined();
    expect(tokens["colors.bg.button.primary.pressed"]).not.toBe(tokens["colors.bg.button.primary.default"]);
  });
});
