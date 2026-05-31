import { describe, expect, test } from "bun:test";
import { defaultThemePreferences, type ThemePreferenceOption } from "@pstdio/ui";
import { dashboardThemePreferences, mergeDashboardThemePreferences } from "./theme-preferences";

describe("mergeDashboardThemePreferences", () => {
  test("uses only built-in themes before extension themes load", () => {
    expect(dashboardThemePreferences).toEqual(defaultThemePreferences);
    expect(dashboardThemePreferences.some((preference: ThemePreferenceOption) => preference.id === "monokai")).toBe(
      false,
    );
  });

  test("adds enabled extension themes after built-in themes", () => {
    const preferences = mergeDashboardThemePreferences([
      {
        id: "lab.monokai",
        mode: "dark",
        tokens: { "colors.bg": "#272822" },
        monacoTheme: { base: "vs-dark", inherit: true, rules: [], colors: {} },
      },
    ]);

    expect(preferences.some((preference: ThemePreferenceOption) => preference.id === "lab.monokai")).toBe(true);
    expect(preferences.at(-1)).toMatchObject({ id: "lab.monokai", tokens: { "colors.bg": "#272822" } });
  });

  test("lets enabled extension themes replace bundled themes with the same id", () => {
    const preferences = mergeDashboardThemePreferences([
      {
        id: "pstdio-dark",
        mode: "dark",
        tokens: { "colors.bg": "#000000" },
      },
    ]);

    expect(preferences.filter((preference) => preference.id === "pstdio-dark")).toHaveLength(1);
    expect(preferences.find((preference) => preference.id === "pstdio-dark")?.tokens?.["colors.bg"]).toBe("#000000");
  });
});
