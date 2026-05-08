import { describe, expect, test } from "bun:test";
import { mergeDashboardThemePreferences } from "./theme-preferences";

describe("mergeDashboardThemePreferences", () => {
  test("adds enabled extension themes after built-in themes", () => {
    const preferences = mergeDashboardThemePreferences([
      {
        id: "lab.monokai",
        mode: "dark",
        tokens: { "colors.bg": "#272822" },
        monacoTheme: { base: "vs-dark", inherit: true, rules: [], colors: {} },
      },
    ]);

    expect(preferences.some((preference) => preference.id === "lab.monokai")).toBe(true);
    expect(preferences.at(-1)).toMatchObject({ id: "lab.monokai", tokens: { "colors.bg": "#272822" } });
  });

  test("lets enabled extension themes replace bundled themes with the same id", () => {
    const preferences = mergeDashboardThemePreferences([
      {
        id: "monokai",
        mode: "dark",
        tokens: { "colors.bg": "#000000" },
      },
    ]);

    expect(preferences.filter((preference) => preference.id === "monokai")).toHaveLength(1);
    expect(preferences.find((preference) => preference.id === "monokai")?.tokens?.["colors.bg"]).toBe("#000000");
  });
});
